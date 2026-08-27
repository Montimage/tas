const { createLogger, format, transports } = require('winston');
const { combine, label, timestamp, printf } = format;
const util = require('util');

/**
 * Structured run logging (issue #47).
 *
 * Every record is one machine-parseable JSON object per line, carrying the
 * time, the level, the run's label and - when the caller supplied one - the
 * correlation identifier that ties all of a request's or a run's records
 * together. The level comes from LOG_LEVEL so an operator can turn it without
 * touching code, and values reached through sensitive keys (passwords, tokens,
 * secrets) are replaced before anything is written.
 *
 * The returned object keeps mirroring the console method signatures - every
 * method accepts any number of arguments and formats them exactly like
 * `console.log` does - so existing call sites (including the common
 * `logger.error('message', err)` pair) keep working unchanged. A trailing
 * plain-object argument is treated as structured metadata: its entries are
 * hoisted to the top level of the JSON record instead of being formatted into
 * the message text.
 */

/** Levels winston's npm scale knows, quietest-first. */
const LEVELS = ['error', 'warn', 'info', 'debug'];

/** The level used when nothing is configured or the configured value is unusable. */
const DEFAULT_LEVEL = 'info';

/**
 * Keys whose values must never reach a log line: passwords, tokens, session
 * identifiers, credentials and similar. Matched case-insensitively against
 * each key of an object being logged; a match replaces the value wholesale
 * rather than trying to sanitise it in place.
 */
const SENSITIVE_KEY =
  /^(pass(word|wd|phrase)?|secret|token|authorization|auth|cookie|credential(s)?|api[-_]?key|access[-_]?key|private[-_]?key|session[-_]?id|session[-_]?secret)$/i;

/** The placeholder a redacted value leaves behind. */
const REDACTED = '[REDACTED]';

/** How deep into a nested value redaction follows before giving up. */
const MAX_REDACTION_DEPTH = 8;

/**
 * Return a redacted copy of `value`. Plain objects and arrays are copied and
 * walked (cycle-safe, depth-bounded); sensitive keys lose their value; every
 * other kind of value passes through untouched. Errors are copied with their
 * message and stack intact but their own enumerable properties redacted, so a
 * library error carrying a document or a connection string cannot leak either.
 *
 * @param {*} value Any value about to be logged
 * @param {Number} [depth] Current recursion depth (internal)
 * @param {WeakSet} [seen] Already-visited objects (internal)
 * @returns {*} A safe copy, or the value itself when nothing needs copying
 */
const redactValue = (value, depth = 0, seen = new WeakSet()) => {
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (depth >= MAX_REDACTION_DEPTH || seen.has(value)) {
    return '[Truncated]';
  }
  if (value instanceof Error) {
    const safe = { message: value.message, stack: value.stack };
    for (const key of Object.keys(value)) {
      safe[key] = SENSITIVE_KEY.test(key) ? REDACTED : redactValue(value[key], depth + 1, seen);
    }
    return safe;
  }
  seen.add(value);
  if (Array.isArray(value)) {
    return value.map((entry) => redactValue(entry, depth + 1, seen));
  }
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) {
    // Class instances (a Mongoose document, say) are formatted by util.inspect
    // as before rather than walked - their constructors decide what is safe.
    return value;
  }
  const safe = {};
  for (const key of Object.keys(value)) {
    safe[key] = SENSITIVE_KEY.test(key) ? REDACTED : redactValue(value[key], depth + 1, seen);
  }
  return safe;
};

/**
 * Read the configured log level from the environment once per logger creation.
 * An unusable value falls back to the default with a warning on the process
 * console, so a typo degrades to the safe verbosity instead of silencing logs.
 *
 * @returns {String} One of LEVELS
 */
const resolveLogLevel = () => {
  const configured = String(process.env.LOG_LEVEL || '')
    .trim()
    .toLowerCase();
  if (configured === '') return DEFAULT_LEVEL;
  if (LEVELS.includes(configured)) return configured;
  console.error(
    `[LOG] Unsupported LOG_LEVEL "${process.env.LOG_LEVEL}" — falling back to ${DEFAULT_LEVEL}`
  );
  return DEFAULT_LEVEL;
};

/**
 * Split variadic arguments into message parts and a metadata object.
 *
 * A trailing plain object is metadata: its entries are recorded as top-level
 * JSON fields next to the message instead of being formatted into it. This is
 * what lets call sites pass `{ requestId }` alongside free-form text while
 * every other argument combination formats exactly like console.log would.
 *
 * @param {Array} args The arguments a log method received
 * @returns {{parts: Array, meta: Object}}
 */
const splitMeta = (args) => {
  const last = args[args.length - 1];
  const proto = last === null || last === undefined ? null : Object.getPrototypeOf(last);
  if (proto === Object.prototype || proto === null) {
    return { parts: args.slice(0, -1), meta: args[args.length - 1] };
  }
  return { parts: args, meta: {} };
};

/** Fields every record owns; metadata entries may not overwrite them. */
const RESERVED_FIELDS = new Set(['timestamp', 'level', 'label', 'message', 'correlationId']);

/**
 * The one-line JSON renderer. Everything a machine needs is at the top level:
 * `timestamp`, `level`, `label`, optional `correlationId`, the `message`,
 * then any metadata fields the caller attached.
 */
const jsonFormat = printf(
  ({ level, message, label: runLabel, timestamp: ts, correlationId, ...rest }) => {
    const record = {
      timestamp: ts,
      level,
      label: runLabel,
      ...(correlationId !== undefined ? { correlationId } : {}),
      message,
    };
    for (const [key, value] of Object.entries(rest)) {
      if (!RESERVED_FIELDS.has(key)) {
        record[key] = value;
      }
    }
    return JSON.stringify(record);
  }
);

/**
 * Get a logger
 *
 * The returned logger owns its run's log file and nothing else: global console
 * methods are never reassigned, so two runs started concurrently each write
 * only their own lines to their own file, and code that does not receive a
 * logger keeps writing to the process console.
 *
 * @param {String} _label the label of the log
 * @param {String} _filename The file name
 * @param {Object} [options]
 * @param {String} [options.correlationId] Correlation identifier written on
 *   every record this logger emits - a request id, a simulation run id, a
 *   campaign id - so all of one request's or one run's lines can be pulled
 *   out of a log with a single filter.
 * @returns {{log: Function, info: Function, warn: Function, error: Function, debug: Function, close: Function}}
 */
const getLogger = (_label, _filename, options = {}) => {
  const correlationId =
    options && options.correlationId !== undefined ? String(options.correlationId) : undefined;

  // Stamped onto every record before rendering, so all of one request's or
  // one run's lines carry the same identifier.
  const attachCorrelation = format((info) => {
    if (correlationId !== undefined) info.correlationId = correlationId;
    return info;
  });

  const logger = createLogger({
    level: resolveLogLevel(),
    format: combine(label({ label: _label }), timestamp(), attachCorrelation(), jsonFormat),
    transports: [new transports.File({ filename: _filename })],
  });

  if (process.env.NODE_ENV !== 'production') {
    logger.add(new transports.Console());
  }

  let closed = false;
  const write = (level, args) => {
    const { parts, meta } = splitMeta(args);
    const safeParts = parts.map((part) => redactValue(part));
    const safeMeta = {};
    for (const [key, value] of Object.entries(redactValue(meta))) {
      if (!RESERVED_FIELDS.has(key)) safeMeta[key] = value;
    }
    if (closed) {
      // The run that owned this file has stopped and its handle has been
      // released. A late asynchronous callback may still try to log; keep the
      // line visible on the process console rather than writing into a closed
      // stream.
      const line = `${util.format(...safeParts)}${
        Object.keys(safeMeta).length > 0 ? ` ${JSON.stringify(safeMeta)}` : ''
      }`;
      console[level === 'info' ? 'log' : level](line);
      return;
    }
    logger.log(level, util.format(...safeParts), safeMeta);
  };

  return {
    log: (...args) => write('info', args),
    info: (...args) => write('info', args),
    warn: (...args) => write('warn', args),
    error: (...args) => write('error', args),
    debug: (...args) => write('debug', args),
    /**
     * Release the file handle(s) of this run's logger. Idempotent; safe to
     * call while late callbacks may still hold a reference.
     */
    close: () => {
      if (closed) return;
      closed = true;
      for (const transport of logger.transports) {
        if (typeof transport.close === 'function') transport.close();
      }
    },
  };
};

module.exports = getLogger;
module.exports.getLogger = getLogger;
module.exports.redactValue = redactValue;
module.exports.resolveLogLevel = resolveLogLevel;
module.exports.LEVELS = LEVELS;
module.exports.DEFAULT_LEVEL = DEFAULT_LEVEL;
module.exports.REDACTED = REDACTED;
