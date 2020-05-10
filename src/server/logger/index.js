const { createLogger, format, transports } = require('winston');
const { combine, timestamp, label, printf } = format;

/**
 * Define the format of the log
 */
const myFormat = printf(({ level, message, label, timestamp }) => {
  return `${timestamp} [${label}] ${level}: ${message}`;
});

/**
 * Get a logger
 * @param {String} label the label of the log
 * @param {String} filename The file name
 */
const getLogger = (_label, _filename) => {
  const logger = createLogger({
    format: combine(
      label({ label: _label }),
      timestamp(),
      myFormat,
      format.colorize()
    ),
    transports: [new transports.File({ filename: _filename })]
  });

  if (process.env.NODE_ENV !== 'production') {
    logger.add(new transports.Console());
  }

  console.log = (message) => {
    logger.log('info', message);
  }
  console.error = (message) => {
    logger.log('error', message);
  }

  return logger;
}

module.exports = getLogger;