/**
 * Login, logout, and "who am I?".
 *
 * These three endpoints are the whole authentication surface. There is no
 * registration and no user administration: TaS is single-tenant, and its one
 * administrator credential is provisioned from the environment (see
 * `auth/credentials.js`), so there is nothing here that can create an account.
 *
 * Two properties are load-bearing and easy to lose in a later edit:
 *
 *   - A failed login is told exactly one thing: "Invalid credentials". Never
 *     which half was wrong, and never whether the username exists. The
 *     credential verifier spends the same work on both cases so the response
 *     time does not say it either.
 *   - Every failure is recorded, with the attempted username, the client
 *     address and a running count of consecutive failures from that address, so
 *     a brute-force run is visible in the log as a run rather than as isolated
 *     lines. The password itself is never part of that record.
 *
 * `GET /session` answers 200 either way, on purpose. The dashboard asks it on
 * every load to decide which screen to draw; answering 401 for "not logged in"
 * would make a normal cold start indistinguishable from a real failure, and
 * would bury genuine 401s in the log.
 */
const express = require('express');
const Joi = require('joi');
const { validate } = require('../middleware/validate');
const { errorHandler, unauthorized, unavailable } = require('../middleware/errors');
const { setSessionCookies, clearSessionCookies } = require('../middleware/auth');

/**
 * How many client addresses the consecutive-failure counter remembers.
 *
 * Bounded on purpose: an unbounded map keyed by a value the caller controls
 * (its source address) is a memory-exhaustion sink, and the counter only has to
 * make a brute-force run legible in the log, not be an accounting record.
 */
const FAILURE_TRACKER_LIMIT = 1000;

/** Longest username or user-agent fragment that goes into a log line. */
const LOG_FIELD_MAX = 200;

/**
 * Make an externally supplied value safe to interpolate into a log line.
 *
 * A newline in a username would let a caller write a second, invented log line
 * - including one that looks like a successful login from somewhere else.
 *
 * @param {*} value Raw value
 * @returns {String} One line's worth of printable text
 */
const sanitizeForLog = (value) =>
  String(value === undefined || value === null ? '' : value)
    .replace(/[\r\n]+/g, ' ')
    // Control characters cannot appear in a log line at all; a quote would end
    // the quoted field early and let a caller fake the fields after it.
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/"/g, "'")
    .slice(0, LOG_FIELD_MAX);

/**
 * Track consecutive failed logins per client address.
 * @returns {{fail: Function, reset: Function, get: Function}}
 */
function createFailureTracker() {
  const failures = new Map();
  return {
    /**
     * @param {String} ip Client address
     * @returns {Number} Consecutive failures from that address, this one included
     */
    fail: function (ip) {
      const key = String(ip || 'unknown');
      const count = (failures.get(key) || 0) + 1;
      // Re-insert so the map stays ordered by recency, then evict the oldest.
      failures.delete(key);
      failures.set(key, count);
      while (failures.size > FAILURE_TRACKER_LIMIT) {
        failures.delete(failures.keys().next().value);
      }
      return count;
    },
    /** @param {String} ip Client address */
    reset: function (ip) {
      failures.delete(String(ip || 'unknown'));
    },
    /**
     * @param {String} ip Client address
     * @returns {Number} Current consecutive failure count
     */
    get: function (ip) {
      return failures.get(String(ip || 'unknown')) || 0;
    },
  };
}

const loginBody = Joi.object({
  username: Joi.string().max(256).required(),
  password: Joi.string().max(1024).required(),
}).required();

/**
 * Build the authentication router.
 *
 * @param {Object} deps
 * @param {Object} deps.credential The configured administrator credential
 * @param {Object} deps.sessions The session store
 * @param {Object} deps.config The loaded configuration
 * @returns {express.Router} The router to mount at `/api/auth`
 */
function createAuthRouter({ credential, sessions, config }) {
  const router = express.Router();
  const tracker = createFailureTracker();

  /**
   * Record one authentication outcome, as a single string.
   *
   * One argument deliberately: `logger/index.js` replaces `console.error` with
   * a single-argument function, so anything passed as a second argument is
   * dropped on the floor once a logger exists.
   *
   * @param {Object} req The login request
   * @param {String} username The attempted username
   * @param {String|null} reason Failure reason, or null for a success
   * @param {Number} failures Consecutive failures from this address
   */
  function logAttempt(req, username, reason, failures) {
    const ip = sanitizeForLog(req.ip);
    const ua = sanitizeForLog(req.get('user-agent') || '-');
    const user = sanitizeForLog(username);
    if (reason === null) {
      console.error(`[AUTH] login succeeded user="${user}" ip=${ip} ua="${ua}"`);
      return;
    }
    console.error(
      `[AUTH] login failed user="${user}" ip=${ip} ua="${ua}" reason=${reason} failures=${failures}`
    );
  }

  router.post('/login', validate({ body: loginBody }), (req, res, next) => {
    const username = req.body.username;
    const password = req.body.password;

    if (!credential.configured) {
      logAttempt(req, username, 'not_configured', tracker.fail(req.ip));
      return next(unavailable('Authentication is not configured'));
    }

    if (!credential.verify(username, password)) {
      logAttempt(req, username, 'invalid_credentials', tracker.fail(req.ip));
      // One message for both halves: naming which one was wrong turns the login
      // form into a username oracle.
      return next(unauthorized('Invalid credentials'));
    }

    tracker.reset(req.ip);
    const session = sessions.create(credential.username);
    setSessionCookies(res, session, config);
    logAttempt(req, credential.username, null, 0);
    // The token is returned in the body as well as in the cookie so a
    // non-browser client can drive the API without parsing Set-Cookie.
    return res.json({
      authenticated: true,
      user: session.user,
      csrfToken: session.csrfToken,
    });
  });

  router.post('/logout', validate(), (req, res) => {
    // Not on the public allowlist, so both the session gate and the CSRF guard
    // have already run: `req.auth` is present and its token was verified.
    if (req.auth && req.auth.sessionId) {
      sessions.destroy(req.auth.sessionId);
    }
    clearSessionCookies(res, config);
    return res.json({ authenticated: false });
  });

  router.get('/session', validate(), (req, res) => {
    // The gate ahead of this router resolves identity for every request,
    // allowlisted or not, and refreshes the cookies while it does — so this
    // endpoint only has to report what it found. Resolving it a second time
    // here would also miss the identity a trusted reverse proxy delegated,
    // which arrives as a header rather than as a cookie.
    if (!req.auth) {
      return res.json({ authenticated: false });
    }
    return res.json({
      authenticated: true,
      user: req.auth.user,
      csrfToken: req.auth.csrfToken,
    });
  });

  router.use(errorHandler);

  return router;
}

module.exports = createAuthRouter;
module.exports.createFailureTracker = createFailureTracker;
module.exports.sanitizeForLog = sanitizeForLog;
