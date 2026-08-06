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
  DEV_DASHBOARD_PORT: '8080'
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
  corsAllowedOrigins: [] // empty = same-origin only
};

/**
 * Split a comma/whitespace separated origin list into normalised origins.
 * @param {String} value Raw configuration value
 * @returns {String[]} Origins without trailing slashes, empties removed
 */
function normalizeOrigins(value) {
  if (!value) {
    return [];
  }
  return value
    .split(/[,\s]+/)
    .map(function (origin) {
      return origin.trim().replace(/\/+$/, '');
    })
    .filter(Boolean);
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
    rateLimitWindowMs: Number(value('RATE_LIMIT_WINDOW_MS')) || SECURITY_DEFAULTS.rateLimitWindowMs,
    rateLimitMax: Number(value('RATE_LIMIT_MAX')) || SECURITY_DEFAULTS.rateLimitMax,
    corsAllowedOrigins: normalizeOrigins(value('CORS_ALLOWED_ORIGINS'))
  });
}

module.exports = {
  loadConfig: loadConfig,
  DEFAULT_CONFIG: DEFAULT_CONFIG
};
