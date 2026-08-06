/**
 * Cross-site request forgery protection for the state-changing API.
 *
 * A session cookie is attached by the browser to *every* request that reaches
 * this origin, including one a page on an unrelated site caused. So a cookie
 * alone proves the request came from a browser that is logged in — not that the
 * dashboard is what asked for it. Without a second factor, any page an operator
 * visits while logged in can start a simulation or delete a topology.
 *
 * The second factor is a token bound to the server-side session, handed to the
 * dashboard in a readable cookie at login and echoed back in the `X-CSRF-Token`
 * header. A cross-site page can cause the cookie to be *sent*, but the same
 * origin policy stops it from ever *reading* the cookie, so it cannot produce
 * the header. The comparison is against the token held in the session record
 * rather than against the cookie, so a request that carries an attacker-chosen
 * cookie pair is checked against what the server issued, not against itself.
 *
 * This layers on top of `SameSite=Lax`, which already blocks the plain
 * cross-site POST in current browsers; the token is what still holds when the
 * request comes from a browser that does not enforce it, or through a path
 * (a same-site subdomain, a redirect chain) where Lax does not apply.
 *
 * Safe methods are untouched: they change nothing, and requiring a header on
 * `GET` would break every plain navigation and every link.
 */
const { forbidden } = require("./errors");
const { timingSafeCompare } = require("../auth/passwords");

/** Methods that must not change state, and therefore need no token. */
const SAFE_METHODS = ["GET", "HEAD", "OPTIONS"];

/**
 * Paths (relative to the `/api` mount) exempt from the check.
 *
 * Login is the one state-changing request that provably cannot carry a token:
 * it is what issues the token. It is protected instead by the credential itself
 * and by a dedicated rate limit — a forged login can only log a victim in as
 * somebody whose password the attacker already knows.
 */
const EXEMPT_PATHS = ["/auth/login"];

/** The header the dashboard echoes the session's token back in. */
const CSRF_HEADER = "x-csrf-token";

/**
 * @param {String} value Raw `req.path`
 * @returns {String} Path without a trailing slash (except the root)
 */
const normalizePath = (value) => {
  const trimmed = String(value || "/").replace(/\/+$/, "");
  return trimmed === "" ? "/" : trimmed;
};

/**
 * Build the CSRF guard. Mounted on `/api`, after the authentication gate, so
 * `req.auth` — and with it the session's token — is already resolved.
 *
 * @returns {Function} Express middleware
 */
function createCsrfMiddleware() {
  return function csrfProtection(req, res, next) {
    if (SAFE_METHODS.indexOf(req.method) !== -1) {
      return next();
    }
    if (EXEMPT_PATHS.indexOf(normalizePath(req.path)) !== -1) {
      return next();
    }

    // No `req.auth` on a state-changing request means the gate did not run or
    // did not attach one, which is a wiring mistake in this file's own mount
    // order. Refuse rather than fall through to the handler.
    const expected = req.auth && req.auth.csrfToken;
    const offered = req.get(CSRF_HEADER);

    if (!expected || typeof offered !== "string" || offered === "") {
      return next(forbidden("Invalid CSRF token"));
    }
    if (!timingSafeCompare(offered, expected)) {
      return next(forbidden("Invalid CSRF token"));
    }
    return next();
  };
}

module.exports = { createCsrfMiddleware, CSRF_HEADER, SAFE_METHODS, EXEMPT_PATHS };
