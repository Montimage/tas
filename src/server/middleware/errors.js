/**
 * The single place where a failure becomes an HTTP response.
 *
 * Every layer reports a failure by handing an error to `next` (or, where there
 * is no `next` to hand, to `sendError`); nothing else writes an error body.
 * That is what keeps one shape — `{ error, details? }` — across the whole API,
 * and what guarantees the underlying error object never reaches the caller: the
 * detail is logged here, server-side, and the response carries only a message
 * the code that raised the failure chose deliberately.
 *
 * A Node fs error carries the absolute path it failed to open in its own
 * enumerable properties, and a Mongoose error carries the document it refused,
 * so echoing either back discloses the server's layout. Nothing that is not an
 * `ApiError` is ever described to the caller — it becomes a bare 500.
 */

/** What the caller is told about a failure whose cause must not be disclosed. */
const INTERNAL_MESSAGE = "Internal server error";

/**
 * A failure with a status code and a message that is safe to return.
 *
 * `details` is the machine-readable per-field breakdown a validation failure
 * carries; `cause` is the underlying error, which is logged and never returned.
 */
class ApiError extends Error {
  /**
   * @param {Number} status HTTP status code this failure maps to
   * @param {String} message Caller-facing message, safe by construction
   * @param {Object} [options]
   * @param {Array}  [options.details] Machine-readable per-field detail
   * @param {*}      [options.cause] The underlying error — logged, never sent
   */
  constructor(status, message, { details, cause } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    if (details !== undefined) this.details = details;
    if (cause !== undefined) this.cause = cause;
  }
}

/** The request was malformed or asked for something it may not ask for. */
const badRequest = (message, details) =>
  new ApiError(400, message || "Invalid request", { details });

/** The caller may not have what it asked for. */
const forbidden = (message) => new ApiError(403, message || "Forbidden");

/** The addressed resource does not exist. */
const notFound = (message) => new ApiError(404, message || "Not found");

/** The request cannot be applied to the current state of the resource. */
const conflict = (message) => new ApiError(409, message || "Conflict");

/** A dependency the request needs is not reachable. */
const unavailable = (message, cause) =>
  new ApiError(503, message || "Service unavailable", { cause });

/** The server failed at something that is not the caller's fault. */
const internal = (message, cause) =>
  new ApiError(500, message || INTERNAL_MESSAGE, { cause });

/** fs error codes that mean "the thing addressed is not there". */
const MISSING_FILE_CODES = ["ENOENT", "ENOTDIR"];

/**
 * Map a filesystem failure onto the status it actually is.
 *
 * A read that fails because the file is not there is a missing resource, not a
 * server fault, and answering 500 for it is what made the two indistinguishable
 * to a client.
 *
 * @param {Error} err The fs error
 * @param {String} missingMessage Message for a resource that is not there
 * @param {String} failureMessage Message for any other read/write failure
 * @returns {ApiError}
 */
const fileError = (err, missingMessage, failureMessage) =>
  err && MISSING_FILE_CODES.indexOf(err.code) !== -1
    ? new ApiError(404, missingMessage, { cause: err })
    : new ApiError(500, failureMessage, { cause: err });

/**
 * Map a database failure onto the status it actually is.
 *
 * A cast failure and a schema violation are both the caller's document being
 * wrong, which is a 400 however late it is discovered; a duplicate key is a
 * conflict. Only what is genuinely ours is a 500. This is the backstop for a
 * constraint the request schemas cannot express, so a rejected write can never
 * again be reported behind a success status.
 *
 * @param {Error} err The database error
 * @param {String} failureMessage Message for a genuine server-side failure
 * @returns {ApiError}
 */
const databaseError = (err, failureMessage) => {
  if (err && err.name === "CastError") {
    return new ApiError(400, "Invalid identifier", { cause: err });
  }
  if (err && err.name === "ValidationError") {
    return new ApiError(400, "Invalid document", { cause: err });
  }
  if (err && (err.code === 11000 || err.code === 11001)) {
    return new ApiError(409, "Already exists", { cause: err });
  }
  return new ApiError(500, failureMessage, { cause: err });
};

/**
 * Failures raised by body-parser before any route runs, and the status each
 * one is. Without this they reach Express's default handler, which answers with
 * an HTML page carrying a stack trace.
 */
const BODY_PARSER_FAILURES = {
  "entity.too.large": [413, "Request entity too large"],
  "entity.parse.failed": [400, "Malformed request body"],
  "entity.verify.failed": [400, "Malformed request body"],
  "encoding.unsupported": [415, "Unsupported content encoding"],
  "request.aborted": [400, "Request aborted"],
};

/**
 * Normalise anything thrown or passed to `next` into an `ApiError`.
 *
 * Only an `ApiError` describes itself to the caller. Everything else is a
 * failure nobody classified, so it is reported as a bare 500 — which is what
 * keeps raw error objects, and the server paths they carry, out of responses.
 *
 * @param {*} err The value handed to `next`
 * @returns {ApiError}
 */
const toApiError = (err) => {
  if (err instanceof ApiError) return err;
  const mapped = err && err.type ? BODY_PARSER_FAILURES[err.type] : null;
  if (mapped) return new ApiError(mapped[0], mapped[1], { cause: err });
  return new ApiError(500, INTERNAL_MESSAGE, { cause: err });
};

/**
 * Render a cause as one log line's worth of text.
 * @param {*} value The underlying error or value
 * @returns {String}
 */
const describe = (value) => {
  if (value instanceof Error) {
    return value.stack || `${value.name}: ${value.message}`;
  }
  if (value === undefined || value === null) return "";
  try {
    return JSON.stringify(value);
  } catch (e) {
    return String(value);
  }
};

/**
 * Record the full detail of a failure server-side.
 *
 * Deliberately one string: `logger/index.js` replaces `console.error` with a
 * single-argument function, so anything passed as a second argument is dropped
 * on the floor once a logger exists — which is how the detail that is no longer
 * in the response would otherwise be lost altogether.
 *
 * @param {Object} req The request, when there is one
 * @param {ApiError} apiError The normalised failure
 */
const logFailure = (req, apiError) => {
  const where =
    req && req.method ? `${req.method} ${req.originalUrl || req.url}` : "request";
  const detail = apiError.cause === undefined ? "" : describe(apiError.cause);
  const details = apiError.details ? ` details=${describe(apiError.details)}` : "";
  console.error(
    `[SERVER] ${where} -> ${apiError.status} ${apiError.message}${details}${
      detail ? ` | ${detail}` : ""
    }`
  );
};

/**
 * The central error handler — the only function in the server that writes an
 * error response.
 *
 * Attached to every router as well as to the application, because a router
 * mounted on its own (as the test suites mount them) would otherwise fall
 * through to Express's default handler and answer with a stack trace.
 */
function errorHandler(err, req, res, next) {
  const apiError = toApiError(err);
  // Routers carry this handler as well as the application does, so a failure
  // delegated below would otherwise be recorded twice.
  if (!apiError.logged) {
    apiError.logged = true;
    logFailure(req, apiError);
  }
  // A failure after the response has started cannot be reported in the body;
  // Express's default handler is the only thing that can close the connection.
  // Delegate the normalised error so the tag above travels with it.
  if (res.headersSent) return next(apiError);
  const payload = { error: apiError.message };
  if (Array.isArray(apiError.details) && apiError.details.length > 0) {
    payload.details = apiError.details;
  }
  return res.status(apiError.status).json(payload);
}

/**
 * Report a failure on a response whose caller holds no `next`.
 *
 * Used by the containment guards, which are handed a response object alone.
 * Routes it through the same handler so there is still exactly one thing in the
 * server that decides what an error response looks like.
 *
 * @param {Object} res The Express response
 * @param {Error} err The failure to report
 */
const sendError = (res, err) => errorHandler(err, res.req, res, () => {});

/**
 * Answer an API path no router claimed with a JSON 404 rather than the SPA's
 * index.html (which a client cannot tell from a successful call).
 */
const apiNotFound = (req, res, next) => next(notFound("Not found"));

module.exports = {
  ApiError,
  badRequest,
  forbidden,
  notFound,
  conflict,
  unavailable,
  internal,
  fileError,
  databaseError,
  errorHandler,
  sendError,
  apiNotFound,
  INTERNAL_MESSAGE,
};
