const { createLogger, format, transports } = require('winston');
const { combine, timestamp, label, printf } = format;
const util = require('util');

/**
 * Define the format of the log
 */
const myFormat = printf(({ level, message, label, timestamp }) => {
  return `${timestamp} [${label}] ${level}: ${message}`;
});

/**
 * Get a logger
 *
 * The returned logger owns its run's log file and nothing else: global console
 * methods are never reassigned, so two runs started concurrently each write
 * only their own lines to their own file, and code that does not receive a
 * logger keeps writing to the process console.
 *
 * The returned object mirrors the console method signatures - every method
 * accepts any number of arguments and formats them exactly like
 * `console.log` does - so it can be used anywhere `console` was used before,
 * including the common `logger.error('message', err)` pair whose error object
 * the old single-argument console replacement silently dropped.
 *
 * @param {String} _label the label of the log
 * @param {String} _filename The file name
 * @returns {{log: Function, info: Function, warn: Function, error: Function, debug: Function, close: Function}}
 */
const getLogger = (_label, _filename) => {
  const logger = createLogger({
    format: combine(label({ label: _label }), timestamp(), myFormat, format.colorize()),
    transports: [new transports.File({ filename: _filename })],
  });

  if (process.env.NODE_ENV !== 'production') {
    logger.add(new transports.Console());
  }

  let closed = false;
  const write = (level, args) => {
    if (closed) {
      // The run that owned this file has stopped and its handle has been
      // released. A late asynchronous callback may still try to log; keep the
      // line visible on the process console rather than writing into a closed
      // stream.
      console[level === 'info' ? 'log' : level](...args);
      return;
    }
    logger.log(level, util.format(...args));
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
