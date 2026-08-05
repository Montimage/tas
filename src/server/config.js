const dotenv = require('dotenv');
const path = require('path');

const DEFAULT_CONFIG = {
  SERVER_HOST: '0.0.0.0',
  SERVER_PORT: '3004',
  DEV_DASHBOARD_PORT: '8080'
};

/**
 * Load the server configuration from a local `.env` file (if present) and
 * fill any missing values with safe defaults.
 *
 * The `.env` file is intentionally not tracked by git - it is the place where
 * operators store machine-specific values and credentials. Without it the
 * server must still start with the documented defaults.
 *
 * @param {Object} [options] Optional overrides
 * @param {String} [options.path] Absolute path to the env file to load
 * @returns {Object} Merged configuration object
 */
const loadConfig = (options = {}) => {
  const envPath = options.path || path.join(process.cwd(), '.env');
  const result = dotenv.config({ path: envPath });
  return Object.assign({}, DEFAULT_CONFIG, result.parsed || {});
};

module.exports = { loadConfig, DEFAULT_CONFIG };
