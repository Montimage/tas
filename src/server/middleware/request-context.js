const { randomUUID } = require('crypto');
const path = require('path');
const getLogger = require('../logger');

/**
 * Request correlation (issue #47).
 *
 * Every request is given a correlation identifier - an incoming trusted
 * `X-Request-Id` is honoured, anything else gets a fresh UUID - which is
 * echoed back in the response header, attached to the access record written
 * when the response finishes, and read by the central error handler so its
 * failure records carry it too. All of one request's lines can therefore be
 * pulled out of the server log with a single filter.
 *
 * The identifier is bounded to characters that are safe in a header and a
 * JSON log line, so a caller cannot smuggle markup or control characters into
 * either through their own header.
 */

/** The process-wide server logger: one structured stream for request traffic. */
let serverLogger = null;

/**
 * The server access/error log lives beside the run logs. Created once per
 * process; failures opening it are winston's to surface, exactly as for run
 * logs.
 */
const getServerLogger = () => {
  if (!serverLogger) {
    serverLogger = getLogger('SERVER', path.join(__dirname, '..', 'logs', 'server.log'));
  }
  return serverLogger;
};

/**
 * Characters a correlation id may carry: letters, digits and the separators
 * an operator's own tracing headers plausibly use. Anything else - and any
 * id longer than 64 characters - is discarded in favour of a fresh UUID.
 */
const SAFE_REQUEST_ID = /^[A-Za-z0-9._-]{1,64}$/;

/**
 * Build the middleware.
 *
 * @param {Object} [options]
 * @param {Function} [options.logger] Overrides the shared server logger
 *   (tests inject one rather than touching files)
 * @param {Boolean} [options.accessLog] Write one record per completed
 *   request (default true)
 * @returns {Function} Express middleware
 */
const requestContext = (options = {}) => {
  const accessLog = options.accessLog !== false;
  return function requestContextMiddleware(req, res, next) {
    const incoming = String((req.get && req.get('x-request-id')) || '').trim();
    const requestId = SAFE_REQUEST_ID.test(incoming) ? incoming : randomUUID();
    req.requestId = requestId;
    res.setHeader('X-Request-Id', requestId);

    if (!accessLog) return next();

    const startedAt = Date.now();
    res.on('finish', () => {
      // One line per request: what was asked, what was answered, how long it
      // took, under which correlation id. Emitted after the response so the
      // status it reports is final.
      getServerLogger().info(`${req.method} ${req.originalUrl || req.url}`, {
        requestId,
        method: req.method,
        path: req.originalUrl || req.url,
        status: res.statusCode,
        durationMs: Date.now() - startedAt,
      });
    });
    return next();
  };
};

module.exports = { requestContext, getServerLogger, SAFE_REQUEST_ID };
