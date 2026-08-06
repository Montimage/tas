/**
 * The gate in front of the API.
 *
 * Everything under `/api` requires an authenticated session. The exception is
 * an explicit, short allowlist declared here — not scattered across the routers
 * — because an allowlist that is written down in one place is one an operator
 * (and a reviewer) can actually read. It holds exactly what has to answer to an
 * anonymous caller: the liveness probe, the login endpoint, and the endpoint
 * the dashboard asks "am I logged in?" before it decides which screen to draw.
 * `POST /api/auth/logout` is deliberately *not* on it: logging out is an act on
 * a session, so it needs one.
 *
 * The static dashboard bundle is served before this middleware and stays public
 * on purpose — the login page is part of that bundle, so gating it would leave
 * a browser with nothing to log in *with*. No operational data is served from
 * there; every value the dashboard renders comes from the API, which is closed.
 *
 * The browser holds nothing but an opaque, signed session identifier. Signing
 * (via `cookie-parser`'s secret) means a forged or edited identifier is
 * rejected before the session table is even consulted, and the identifier
 * itself carries no claims that could be tampered with in the first place.
 *
 * Identity may instead be delegated to a reverse proxy that has already
 * authenticated the caller, but only when two independent settings agree: the
 * feature is switched on *and* the peer address is on the trusted-proxy list.
 * A header alone is not evidence of anything — anyone who can reach the port
 * can send `X-Forwarded-User: admin` — so trusting the header without pinning
 * the peer would make the feature the bypass it exists to avoid.
 */
const { unauthorized } = require("./errors");
const { timingSafeCompare } = require("../auth/passwords");

/** Name of the signed cookie carrying the opaque session identifier. */
const SESSION_COOKIE = "tas.sid";

/**
 * Name of the readable cookie carrying the CSRF token. Deliberately NOT
 * httpOnly: the dashboard has to read it to echo it back in a request header,
 * which is the whole mechanism (see `middleware/csrf.js`).
 */
const CSRF_COOKIE = "tas.csrf";

/**
 * The endpoints that answer without a session, relative to the `/api` mount.
 * Documented in the README; changing this list changes the attack surface.
 */
const PUBLIC_API_ROUTES = [
  { method: "GET", path: "/health" },
  { method: "POST", path: "/auth/login" },
  { method: "GET", path: "/auth/session" },
];

/**
 * Normalise a request path for allowlist comparison: a trailing slash is the
 * same resource, and nothing else about the path is negotiable.
 * @param {String} value Raw `req.path`
 * @returns {String} Path without a trailing slash (except the root)
 */
const normalizePath = (value) => {
  const path = String(value || "/");
  const trimmed = path.replace(/\/+$/, "");
  return trimmed === "" ? "/" : trimmed;
};

/**
 * @param {String} method HTTP method
 * @param {String} path Path relative to the `/api` mount
 * @returns {Boolean} True when the request may proceed without a session
 */
const isPublicRoute = (method, path) => {
  // A CORS preflight carries no credentials by definition; rejecting it with a
  // 401 would make the browser report a CORS failure for a request that would
  // in fact have been authorised.
  if (method === "OPTIONS") return true;
  const wanted = normalizePath(path);
  return PUBLIC_API_ROUTES.some(
    (route) => route.method === method && route.path === wanted
  );
};

/**
 * Cookie attributes shared by both session cookies.
 * @param {Object} config The loaded configuration
 * @returns {Object} Options for `res.cookie`
 */
const baseCookieOptions = (config) => ({
  sameSite: "lax",
  path: "/",
  secure: config.sessionCookieSecure === true,
  maxAge: config.sessionIdleTtlMs,
});

/**
 * Issue (or refresh) the pair of cookies a browser session is made of.
 *
 * Re-issued on every authenticated request so the cookie's own lifetime tracks
 * the sliding server-side session rather than expiring underneath it.
 *
 * @param {Object} res Express response
 * @param {Object} session The session record
 * @param {Object} config The loaded configuration
 */
function setSessionCookies(res, session, config) {
  res.cookie(SESSION_COOKIE, session.id, {
    ...baseCookieOptions(config),
    httpOnly: true,
    signed: true,
  });
  res.cookie(CSRF_COOKIE, session.csrfToken, {
    ...baseCookieOptions(config),
    httpOnly: false,
    signed: false,
  });
}

/**
 * Remove both cookies. The attributes must match the ones they were set with,
 * or the browser keeps the original cookie alongside the expired one.
 * @param {Object} res Express response
 * @param {Object} config The loaded configuration
 */
function clearSessionCookies(res, config) {
  const options = {
    sameSite: "lax",
    path: "/",
    secure: config.sessionCookieSecure === true,
  };
  // Not signed: an expiring cookie carries no value worth signing, and signing
  // an empty string produces a `s:.<mac>` value that reads like a live session.
  res.clearCookie(SESSION_COOKIE, { ...options, httpOnly: true });
  res.clearCookie(CSRF_COOKIE, { ...options, httpOnly: false });
}

/**
 * Resolve the live session a request carries, refreshing its idle window.
 *
 * Shared by the gate and by `GET /api/auth/session`, which has to answer the
 * same question from outside the gate.
 *
 * @param {Object} req Express request
 * @param {Object} sessions The session store
 * @returns {Object|null} The live session, or null
 */
function resolveSession(req, sessions) {
  const signed = req.signedCookies || {};
  const id = signed[SESSION_COOKIE];
  if (typeof id !== "string" || id === "") return null;
  return sessions.touch(id);
}

/**
 * Reduce a socket address to the form the trusted-proxy list is written in.
 *
 * IPv4 peers reaching a dual-stack listener arrive as `::ffff:127.0.0.1`; that
 * prefix is stripped so an operator can write `127.0.0.1`. Nothing else is
 * folded together — `::1` and `127.0.0.1` are different addresses and treating
 * them as one would silently widen a configured list.
 *
 * @param {String} address Raw remote address
 * @returns {String} Normalised address
 */
const normalizeAddress = (address) =>
  String(address || "").replace(/^::ffff:/i, "");

/**
 * Build the `/api` authentication gate.
 *
 * @param {Object} deps
 * @param {Object} deps.credential The configured administrator credential
 * @param {Object} deps.sessions The session store
 * @param {Object} deps.config The loaded configuration
 * @returns {Function} Express middleware
 */
function createAuthMiddleware({ credential, sessions, config }) {
  const trustedProxies = Array.isArray(config.authTrustedProxies)
    ? config.authTrustedProxies.map(normalizeAddress)
    : [];
  // Both conditions, deliberately: an operator who sets the flag but forgets
  // the list gets the feature switched off (and a startup warning), not a
  // server that believes whatever header it is handed.
  const proxyDelegationActive =
    config.authTrustProxyHeader === true && trustedProxies.length > 0;
  const proxyUserHeader = String(config.authProxyUserHeader || "x-forwarded-user").toLowerCase();

  /**
   * @param {Object} req Express request
   * @returns {String|null} The identity the proxy asserts, when it may be believed
   */
  function proxyIdentity(req) {
    if (!proxyDelegationActive) return null;
    const peer = normalizeAddress(req.socket && req.socket.remoteAddress);
    if (trustedProxies.indexOf(peer) === -1) return null;
    const asserted = req.headers[proxyUserHeader];
    if (typeof asserted !== "string") return null;
    const user = asserted.trim();
    return user === "" ? null : user;
  }

  return function requireAuth(req, res, next) {
    if (isPublicRoute(req.method, req.path)) {
      return next();
    }

    const session = resolveSession(req, sessions);
    if (session) {
      req.auth = {
        user: session.user,
        sessionId: session.id,
        csrfToken: session.csrfToken,
        via: "session",
      };
      setSessionCookies(res, session, config);
      return next();
    }

    const delegated = proxyIdentity(req);
    if (delegated) {
      const created = sessions.create(delegated);
      req.auth = {
        user: created.user,
        sessionId: created.id,
        csrfToken: created.csrfToken,
        via: "proxy",
      };
      setSessionCookies(res, created, config);
      return next();
    }

    return next(unauthorized("Authentication required"));
  };
}

module.exports = {
  createAuthMiddleware,
  setSessionCookies,
  clearSessionCookies,
  resolveSession,
  isPublicRoute,
  normalizeAddress,
  timingSafeCompare,
  PUBLIC_API_ROUTES,
  SESSION_COOKIE,
  CSRF_COOKIE,
};
