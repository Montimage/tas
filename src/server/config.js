var dotenv = require('dotenv');

function loadConfig() {
  // Always return safe defaults so the server can start without a .env file.
  var defaults = {
    serverHost: '0.0.0.0',
    serverPort: '3004',
    bodyLimit: '1mb',
    rateLimitWindowMs: 15 * 60 * 1000, // 15 minutes
    rateLimitMax: 1000, // requests per window per client
    corsAllowedOrigins: [] // empty = same-origin only
  };

  dotenv.config();

  function env(key) {
    return process.env[key];
  }

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

  return {
    host: env('SERVER_HOST') || defaults.serverHost,
    port: env('SERVER_PORT') || defaults.serverPort,
    bodyLimit: env('BODY_LIMIT') || env('MAX_BODY_SIZE') || defaults.bodyLimit,
    rateLimitWindowMs: Number(env('RATE_LIMIT_WINDOW_MS')) || defaults.rateLimitWindowMs,
    rateLimitMax: Number(env('RATE_LIMIT_MAX')) || defaults.rateLimitMax,
    corsAllowedOrigins: normalizeOrigins(env('CORS_ALLOWED_ORIGINS'))
  };
}

module.exports = {
  loadConfig: loadConfig
};