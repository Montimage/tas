var crypto = require('crypto');
var dotenv = require('dotenv');
var fs = require('fs');
var path = require('path');

/**
 * Operator-facing configuration keys. Every key here MUST be documented in
 * `env.example` with the same value - `test/env-config.test.js` enforces that.
 */
var DEFAULT_CONFIG = {
  SERVER_HOST: '0.0.0.0',
  SERVER_PORT: '3004',
  DEV_DASHBOARD_PORT: '8080',
};

/**
 * Hardening defaults. These are deliberately not in `env.example`: an operator
 * should only need to touch them to relax a limit, and the safe value is the
 * one that applies when nothing is set.
 */
var SECURITY_DEFAULTS = {
  bodyLimit: '1mb',
  rateLimitWindowMs: 15 * 60 * 1000, // 15 minutes
  rateLimitMax: 1000, // requests per window per client
  corsAllowedOrigins: [], // empty = same-origin only
  cspReportOnly: false, // enforce the policy; `CSP_REPORT_ONLY=true` observes first
  cspReportUri: '', // empty = browsers report to the console only
  authAdminUsername: 'admin', // the single operator account
  authAdminPassword: '', // plaintext bootstrap; hashed and erased by createCredential
  authAdminPasswordHash: '', // preferred: a `scrypt$...` value from hashPassword
  sessionIdleTtlMs: 60 * 60 * 1000, // 1 hour of inactivity ends a session
  sessionAbsoluteTtlMs: 12 * 60 * 60 * 1000, // no session outlives 12 hours
  sessionMaxRecords: 1000, // hard cap on the session table; oldest is evicted
  // Plain HTTP on loopback behind a TLS-terminating reverse proxy is the
  // documented deployment baseline, and a `Secure` cookie is simply never sent
  // over such a connection - hard-coding it on would make the shipped
  // `docker run` unable to log in at all. Operators whose TLS reaches the
  // application itself must set SESSION_COOKIE_SECURE=true; the README says so.
  sessionCookieSecure: false,
  authTrustProxyHeader: false, // identity delegation is opt-in, and off by default
  authProxyUserHeader: 'x-forwarded-user',
  authTrustedProxies: [], // empty = delegation stays off, whatever the flag says
  authLoginRateLimitWindowMs: 15 * 60 * 1000,
  authLoginRateLimitMax: 10, // failed logins per window per client
};

/**
 * Emitted once per process, so a restart loop does not bury the rest of the log.
 */
var warnedAboutSessionSecret = false;

/**
 * Read the secret the session cookie is signed with.
 *
 * There is deliberately no default value. A hardcoded fallback would ship in
 * the image, be identical in every deployment, and be readable by anyone with
 * the source - which is to say it would let anyone mint a valid session cookie.
 *
 * Refusing to start instead would turn a missing hardening knob into an outage
 * for every existing deployment, container healthcheck and smoke test that has
 * never heard of this setting. An ephemeral per-process secret is the fail-safe
 * middle: it cannot be guessed, it is never shared, it degrades only in that
 * sessions do not survive a restart - and it says so, loudly, at startup. The
 * value itself is never logged.
 *
 * @param {String} configured Raw configuration value
 * @returns {String} The secret to sign session cookies with
 */
function resolveSessionSecret(configured) {
  var secret = String(configured || '').trim();
  if (secret !== '') {
    return secret;
  }
  if (!warnedAboutSessionSecret) {
    warnedAboutSessionSecret = true;
    console.error(
      '[AUTH] SESSION_SECRET is not set — generated an ephemeral secret; all sessions will be invalidated when this process restarts. Set SESSION_SECRET in production.'
    );
  }
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Split a comma/whitespace separated list into trimmed, non-empty entries.
 *
 * One helper serves both plain lists and origin lists: an origin list is the
 * same split with each entry's trailing slash(es) removed, so the two forms
 * cannot drift apart.
 *
 * @param {String} value Raw configuration value
 * @param {Object} [options]
 * @param {Boolean} [options.stripTrailingSlashes] Strip trailing slashes from each entry
 * @returns {String[]} The entries
 */
function normalizeList(value, options) {
  var stripTrailingSlashes = options && options.stripTrailingSlashes;
  if (!value) {
    return [];
  }
  return value
    .split(/[,\s]+/)
    .map(function (entry) {
      var trimmed = entry.trim();
      return stripTrailingSlashes ? trimmed.replace(/\/+$/, '') : trimmed;
    })
    .filter(Boolean);
}

/**
 * Read a configuration value that is a yes/no switch.
 *
 * Unset (or empty) means the safe default applies. Anything an operator would
 * reasonably write for "off" turns it off; every other value turns it on, so a
 * typo fails towards the stricter setting rather than silently disabling it.
 * @param {String} value Raw configuration value
 * @param {Boolean} fallback Value to use when nothing is configured
 * @returns {Boolean} Parsed switch
 */
function parseBoolean(value, fallback) {
  if (value === undefined || value === null || String(value).trim() === '') {
    return fallback;
  }
  return ['false', '0', 'no', 'off'].indexOf(String(value).trim().toLowerCase()) === -1;
}

/**
 * Read a configuration value that has to be a number.
 *
 * Unset (or empty) means the safe default applies. Everything else has to be
 * an actual number: `Number(value) || default` would silently coerce both a
 * deliberate `0` and a typo into the built-in default, so instead a value that
 * is not a number fails at startup naming the setting. A negative value is
 * meaningless for every one of these knobs and fails the same way; so does a
 * deliberate `0` where zero cannot work, while a knob where `0` is a
 * meaningful operator statement accepts it (`allowZero`).
 *
 * @param {String} key Operator-facing configuration key, named in error messages
 * @param {String} value Raw configuration value
 * @param {Number} fallback Value to use when nothing is configured
 * @param {Object} [options]
 * @param {Boolean} [options.allowZero] Accept a deliberate `0` (default false)
 * @returns {Number} Parsed numeric value
 * @throws {Error} When the value is not a number, negative, or an unusable zero
 */
function parseNumeric(key, value, fallback, options) {
  var allowZero = options && options.allowZero;
  if (value === undefined || value === null || String(value).trim() === '') {
    return fallback;
  }
  var parsed = Number(String(value).trim());
  if (!Number.isFinite(parsed)) {
    throw new Error(key + ' must be a number; got "' + value + '"');
  }
  if (parsed < 0) {
    throw new Error(key + ' must not be negative');
  }
  if (parsed === 0 && !allowZero) {
    throw new Error(key + ' must be greater than 0');
  }
  return parsed;
}

/**
 * Read the endpoint browsers should send policy violation reports to.
 *
 * `;` and `,` separate directives inside a Content Security Policy, so a value
 * carrying either would be an attempt to append directives to the policy. The
 * header middleware refuses such a value too, but it does so from deep inside a
 * dependency and never names the setting that caused it, which leaves an
 * operator with a stack trace instead of a fix.
 * @param {String} value Raw configuration value
 * @returns {String} The trimmed endpoint, empty when unset
 * @throws {Error} When the value could break out of the directive
 */
function parseReportUri(value) {
  var uri = String(value || '').trim();
  if (/[;,]/.test(uri)) {
    throw new Error(
      'CSP_REPORT_URI must not contain ";" or "," - they would inject CSP directives'
    );
  }
  // Interior whitespace would add a second, bogus report endpoint to the
  // directive; a control character (a newline pasted out of a config file, say)
  // cannot go into a header at all, and would turn every single response into a
  // 500 with a stack trace from inside the HTTP layer - long after startup,
  // where an operator has nothing to connect it to. Fail here instead.
  if (/[\s\u0000-\u001f\u007f]/.test(uri)) {
    throw new Error('CSP_REPORT_URI must not contain whitespace or control characters');
  }
  return uri;
}

/**
 * Load the server configuration from a local `.env` file (if present) and fill
 * any missing values with safe defaults.
 *
 * Precedence is: real process environment > `.env` file > defaults. The process
 * environment has to win so a container, a CI job or a test harness can
 * override a value without editing (or shadowing) the operator's `.env` file.
 *
 * The file is read with `dotenv.parse` rather than `dotenv.config` so loading
 * never mutates `process.env` - otherwise a call with an explicit `path` would
 * leak its values into every later call in the same process.
 *
 * The result carries both views of the configuration: the documented uppercase
 * keys (`SERVER_HOST`, ...) and the derived values the server actually applies
 * (`host`, `bodyLimit`, `corsAllowedOrigins`, ...).
 *
 * @param {Object} [options] Optional overrides
 * @param {String} [options.path] Absolute path to the env file to load
 * @returns {Object} Merged configuration object
 */
function loadConfig(options) {
  var opts = options || {};
  var envPath = opts.path || path.join(process.cwd(), '.env');

  var parsed = {};
  try {
    parsed = dotenv.parse(fs.readFileSync(envPath));
  } catch (_) {
    // No readable .env file - the documented defaults apply.
  }

  function value(key) {
    return process.env[key] !== undefined ? process.env[key] : parsed[key];
  }

  var merged = Object.assign({}, DEFAULT_CONFIG, parsed);
  Object.keys(merged).forEach(function (key) {
    if (process.env[key] !== undefined && process.env[key] !== '') {
      merged[key] = process.env[key];
    }
  });

  return Object.assign(merged, {
    host: merged.SERVER_HOST || DEFAULT_CONFIG.SERVER_HOST,
    port: merged.SERVER_PORT || DEFAULT_CONFIG.SERVER_PORT,
    bodyLimit: value('BODY_LIMIT') || value('MAX_BODY_SIZE') || SECURITY_DEFAULTS.bodyLimit,
    rateLimitWindowMs: parseNumeric(
      'RATE_LIMIT_WINDOW_MS',
      value('RATE_LIMIT_WINDOW_MS'),
      SECURITY_DEFAULTS.rateLimitWindowMs
    ),
    // `0` is honoured: under express-rate-limit v8 a limit of 0 blocks every
    // request, which is exactly the lockdown an operator writing it asked for.
    rateLimitMax: parseNumeric(
      'RATE_LIMIT_MAX',
      value('RATE_LIMIT_MAX'),
      SECURITY_DEFAULTS.rateLimitMax,
      {
        allowZero: true,
      }
    ),
    corsAllowedOrigins: normalizeList(value('CORS_ALLOWED_ORIGINS'), {
      stripTrailingSlashes: true,
    }),
    cspReportOnly: parseBoolean(value('CSP_REPORT_ONLY'), SECURITY_DEFAULTS.cspReportOnly),
    cspReportUri: parseReportUri(value('CSP_REPORT_URI') || SECURITY_DEFAULTS.cspReportUri),
    authAdminUsername: value('AUTH_ADMIN_USERNAME') || SECURITY_DEFAULTS.authAdminUsername,
    authAdminPassword: value('AUTH_ADMIN_PASSWORD') || SECURITY_DEFAULTS.authAdminPassword,
    authAdminPasswordHash:
      value('AUTH_ADMIN_PASSWORD_HASH') || SECURITY_DEFAULTS.authAdminPasswordHash,
    sessionSecret: resolveSessionSecret(value('SESSION_SECRET')),
    sessionIdleTtlMs: parseNumeric(
      'SESSION_TTL_MS',
      value('SESSION_TTL_MS'),
      SECURITY_DEFAULTS.sessionIdleTtlMs
    ),
    sessionAbsoluteTtlMs: parseNumeric(
      'SESSION_ABSOLUTE_TTL_MS',
      value('SESSION_ABSOLUTE_TTL_MS'),
      SECURITY_DEFAULTS.sessionAbsoluteTtlMs
    ),
    sessionMaxRecords: parseNumeric(
      'SESSION_MAX_RECORDS',
      value('SESSION_MAX_RECORDS'),
      SECURITY_DEFAULTS.sessionMaxRecords
    ),
    sessionCookieSecure: parseBoolean(
      value('SESSION_COOKIE_SECURE'),
      SECURITY_DEFAULTS.sessionCookieSecure
    ),
    authTrustProxyHeader: parseBoolean(
      value('AUTH_TRUST_PROXY_HEADER'),
      SECURITY_DEFAULTS.authTrustProxyHeader
    ),
    authProxyUserHeader: value('AUTH_PROXY_USER_HEADER') || SECURITY_DEFAULTS.authProxyUserHeader,
    authTrustedProxies: normalizeList(value('AUTH_TRUSTED_PROXIES')),
    authLoginRateLimitWindowMs: parseNumeric(
      'AUTH_LOGIN_RATE_LIMIT_WINDOW_MS',
      value('AUTH_LOGIN_RATE_LIMIT_WINDOW_MS'),
      SECURITY_DEFAULTS.authLoginRateLimitWindowMs
    ),
    // `0` failed logins tolerated is a deliberate hard lockdown of the login
    // endpoint: honoured, like the general rate-limit max above.
    authLoginRateLimitMax: parseNumeric(
      'AUTH_LOGIN_RATE_LIMIT_MAX',
      value('AUTH_LOGIN_RATE_LIMIT_MAX'),
      SECURITY_DEFAULTS.authLoginRateLimitMax,
      { allowZero: true }
    ),
  });
}

module.exports = {
  loadConfig: loadConfig,
  DEFAULT_CONFIG: DEFAULT_CONFIG,
};
