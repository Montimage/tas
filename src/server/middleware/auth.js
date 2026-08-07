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
 *
 * Identity is resolved *before* the allowlist is consulted, and the allowlist
 * then only decides whether a request with no identity is refused. That order
 * matters: `GET /api/auth/session` is public, and it is the first call the
 * dashboard makes. Answering it before delegation had been considered would
 * report `{"authenticated":false}` to a browser the proxy had already
 * authenticated, and show it a password form for an account whose password a
 * proxy deployment deliberately does not hand out.
 */
const { unauthorized } = require("./errors");
const { timingSafeCompare } = require("../auth/passwords");

/**
 * How many delegated identities the proxy session cache remembers.
 *
 * The key is asserted by the proxy, so it is outside data; bounding the map
 * keeps a misbehaving (or compromised) proxy from turning the cache into a
 * memory sink. Evicting the oldest entry only costs that identity a fresh
 * session record on its next request.
 */
const DELEGATED_IDENTITY_LIMIT = 1000;

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
 * Is this OPTIONS request a genuine CORS preflight?
 *
 * A preflight is defined by the two headers the browser always sends with it.
 * Requiring both is what keeps the exemption to preflights: a *bare* OPTIONS
 * carries neither, and exempting it would let Express's built-in OPTIONS
 * responder answer an anonymous caller with an `Allow` header assembled from
 * the registered handlers — an endpoint-and-method map of the whole API, while
 * an unrouted path 404s, which is exactly the disclosure the deliberate 401 on
 * unknown `/api` paths exists to prevent.
 *
 * @param {Object} req Express request
 * @returns {Boolean} True for a CORS preflight
 */
const isCorsPreflight = (req) =>
  req.method === "OPTIONS" &&
  typeof req.headers["origin"] === "string" &&
  typeof req.headers["access-control-request-method"] === "string";

/**
 * @param {Object} req Express request
 * @returns {Boolean} True when the request may proceed without a session
 */
const isPublicRoute = (req) => {
  // A CORS preflight carries no credentials by definition; rejecting it with a
  // 401 would make the browser report a CORS failure for a request that would
  // in fact have been authorised.
  if (isCorsPreflight(req)) return true;
  const wanted = normalizePath(req.path);
  return PUBLIC_API_ROUTES.some(
    (route) => route.method === req.method && route.path === wanted
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

  /**
   * The session already issued for each delegated identity.
   *
   * Without this, every cookieless request from behind the proxy — a curl call,
   * a monitoring probe, a CI script — would mint a session record of its own,
   * and `sweep()` only reclaims records that have *expired*, so at the default
   * one-hour idle window the table would grow with traffic rather than with
   * users. A browser establishes its session on the first GET and carries the
   * cookie afterwards; a cookieless client reuses this one record.
   *
   * Bounded like the login failure tracker, and for the same reason: the key
   * comes from outside, so an unbounded map is a memory sink.
   */
  const delegatedSessions = new Map();

  /**
   * Resolve (reusing where possible) the session that stands for a delegated
   * identity.
   *
   * @param {String} user The identity the trusted proxy asserted
   * @returns {Object} A live session record for that identity
   */
  function delegatedSession(user) {
    const known = delegatedSessions.get(user);
    if (typeof known === "string") {
      const live = sessions.touch(known);
      // A cached identifier can be stale: the session may have expired, or
      // `POST /auth/logout` may have destroyed it. Either way, fall through and
      // mint a fresh one rather than hand back nothing.
      if (live && live.user === user) {
        delegatedSessions.delete(user);
        delegatedSessions.set(user, known);
        return live;
      }
      delegatedSessions.delete(user);
    }
    const created = sessions.create(user);
    delegatedSessions.set(user, created.id);
    while (delegatedSessions.size > DELEGATED_IDENTITY_LIMIT) {
      delegatedSessions.delete(delegatedSessions.keys().next().value);
    }
    return created;
  }

  return function requireAuth(req, res, next) {
    // Identity first, allowlist second. See the note at the top of this file:
    // a public route still has to know who the caller is, or the endpoint the
    // dashboard boots with cannot report a proxy-delegated login.
    let session = resolveSession(req, sessions);
    let via = "session";

    if (!session) {
      const delegated = proxyIdentity(req);
      if (delegated) {
        session = delegatedSession(delegated);
        via = "proxy";
      }
    }

    if (session) {
      req.auth = {
        user: session.user,
        sessionId: session.id,
        csrfToken: session.csrfToken,
        via: via,
      };
      setSessionCookies(res, session, config);
    }

    // A proxy-delegated request is deliberately NOT exempted from the CSRF
    // check downstream. The proxy attaches the identity header to whatever
    // reaches it, cookies or no cookies — so a cross-site forged POST from
    // evil.com arrives in exactly the shape of a cookieless delegated request.
    // Exempting that shape would hand an attacker authenticated, state-changing
    // access. A non-browser client behind the proxy fetches
    // `GET /api/auth/session` first and echoes the token back, which is what
    // the README documents.
    // A genuine preflight is answered here rather than passed on. Handing it to
    // the router means Express's built-in OPTIONS responder answers an
    // anonymous caller with an `Allow` header assembled from the registered
    // handlers, while an unrouted path 404s — the endpoint-and-method map that
    // the deliberate 401 on a bare OPTIONS exists to deny. The two headers that
    // define a preflight are trivially forged by a non-browser client, so the
    // exemption has to stop at "answer it", not "let it through".
    if (isCorsPreflight(req)) {
      return res.sendStatus(204);
    }
    if (isPublicRoute(req)) {
      return next();
    }
    if (!req.auth) {
      return next(unauthorized("Authentication required"));
    }
    return next();
  };
}

module.exports = {
  createAuthMiddleware,
  setSessionCookies,
  clearSessionCookies,
  resolveSession,
  isPublicRoute,
  isCorsPreflight,
  normalizeAddress,
  timingSafeCompare,
  PUBLIC_API_ROUTES,
  DELEGATED_IDENTITY_LIMIT,
  SESSION_COOKIE,
  CSRF_COOKIE,
};
