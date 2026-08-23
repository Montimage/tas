/* Working with Data Generator */
var express = require('express');
const path = require('path');
const fs = require('fs');
const { readDir, deleteFile } = require('../../core/utils');
const { resolveWithin, sendBadRequest } = require('./path-safety');
const { validate, fileNameParam, generatedFileNameMaxLength } = require('../middleware/validate');
const { errorHandler, fileError, internal } = require('../middleware/errors');

const _logsPath = `${__dirname}/../logs/`;

// The log root has one subdirectory per kind of log the server writes, and
// each mounted instance reads exactly one of them (issue #84). Keeping the
// list here means a misspelled or defaulted kind fails at mount time instead
// of silently serving a directory that can never exist.
const LOG_KINDS = ['data-recorders', 'simulations', 'test-campaigns'];

// ---------------------------------------------------------------------------
// Validation schemas for the log endpoints (issue #10)
// ---------------------------------------------------------------------------

// These routes address names the server generated, not names a caller supplied:
// a log is written as `${name}_${timestamp}.log`, so it is longer than the name
// it came from. Capping it like a plain derived filename would refuse to read or
// delete the logs the product itself writes.
const logFileNameParam = fileNameParam('.log', generatedFileNameMaxLength('.log'));

// Hard cap on how much of one log a single read may move (F-PERF-003, issue
// #85). A run's logger appends forever, so an uncapped read let one request
// grow process memory in proportion to the whole file. Reads are bounded two
// ways:
// - without a `Range` header the endpoint answers with the LAST
//   `LOG_READ_MAX_BYTES` bytes of the file (the tail is what a dashboard
//   wants), inside the same `{ error, content }` JSON envelope as before plus
//   additive metadata (`truncated`, `totalSize`, `returnedSize`, `offset`);
// - with a single-interval `bytes=` range the slice is STREAMED straight from
//   disk to the socket (206, `text/plain`) and never buffered at all.
// Both paths are therefore O(cap) or O(range) in memory regardless of file
// size. The cap also applies to a requested range that is larger than it.
const LOG_READ_MAX_BYTES = 1024 * 1024;

/**
 * Read `[start, end]` of a file into a buffer through a stream.
 * @param {String} filePath The file to read
 * @param {Number} start First byte offset (inclusive)
 * @param {Number} end Last byte offset (inclusive)
 * @param {Function} callback Invoked with (err, buffer)
 */
const readFileWindow = (filePath, start, end, callback) => {
  const chunks = [];
  let settled = false;
  const stream = fs.createReadStream(filePath, { start, end });
  stream.on('data', (chunk) => chunks.push(chunk));
  stream.on('error', (err) => {
    if (settled) return;
    settled = true;
    stream.destroy();
    callback(err);
  });
  stream.on('end', () => {
    if (settled) return;
    settled = true;
    callback(null, Buffer.concat(chunks));
  });
};

/**
 * Parse a single-interval `Range: bytes=…` header against a file size.
 *
 * Returns `{ start, end }` (inclusive offsets, clamped to the file and to the
 * hard cap), `'unsatisfiable'`, or null when the header is absent, malformed,
 * names another unit, carries several ranges, or is otherwise ignorable — per
 * RFC 9110 a server MAY ignore a Range it does not understand.
 * @param {String|undefined} header The raw Range header
 * @param {Number} size The file size in bytes
 */
const parseByteRange = (header, size) => {
  if (!header || typeof header !== 'string') return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match) return null;
  const [, rawStart, rawEnd] = match;
  if (rawStart === '' && rawEnd === '') return null;
  if (size === 0) return 'unsatisfiable';
  if (rawStart === '') {
    // Suffix form `-N`: the final N bytes. Zero-length suffixes cannot be met.
    const suffix = Number(rawEnd);
    if (!Number.isInteger(suffix) || suffix <= 0) return 'unsatisfiable';
    const capped = Math.min(suffix, LOG_READ_MAX_BYTES);
    return { start: Math.max(0, size - capped), end: size - 1 };
  }
  const start = Number(rawStart);
  if (!Number.isInteger(start)) return null;
  if (start >= size) return 'unsatisfiable';
  let end = size - 1;
  if (rawEnd !== '') {
    const parsedEnd = Number(rawEnd);
    if (!Number.isInteger(parsedEnd)) return null;
    // An interval whose end precedes its start is invalid, and an invalid
    // Range is ignored entirely (RFC 9110 §14.1.1) - serving it would ask
    // the file stream for a negative slice that never completes.
    if (parsedEnd < start) return null;
    end = Math.min(parsedEnd, size - 1);
  }
  // One interval longer than the cap delivers only its first cap bytes; the
  // response still carries a truthful Content-Range for what was sent.
  end = Math.min(end, start + LOG_READ_MAX_BYTES - 1);
  return { start, end };
};

const createRouter = (appLog) => {
  if (!LOG_KINDS.includes(appLog)) {
    throw new TypeError(
      `Unknown log kind: ${String(appLog)}. Expected one of: ${LOG_KINDS.join(', ')}`
    );
  }
  let router = express.Router();
  let logsPath = `${_logsPath}${appLog}/`;

  /////////////
  // LOG FILES
  /////////////
  // Get all the logs file
  router.get('/', validate(), (req, res, next) => {
    readDir(logsPath, (err, files) => {
      if (err && err.code === 'ENOENT') {
        // Nothing under the log root is created up front: a directory that does
        // not exist yet is an empty collection, not a missing resource. It is
        // the only listing in the API that can legitimately be absent.
        res.send({
          error: null,
          files: [],
        });
      } else if (err) {
        next(internal('Cannot read the logs directory', err));
      } else {
        res.send({
          error: null,
          files: files.filter((f) => path.extname(f) === '.log'),
        });
      }
    });
  });

  // Read a specific log file
  router.get(
    '/:fileName',
    validate({ params: { fileName: logFileNameParam } }),
    function (req, res, next) {
      const { fileName } = req.params;
      const logFile = resolveWithin(logsPath, fileName);
      if (!logFile) {
        return sendBadRequest(res, 'Invalid log file name');
      }
      fs.stat(logFile, (statErr, stats) => {
        if (statErr) {
          return next(fileError(statErr, 'Log file not found', 'Cannot read the log file'));
        }

        const totalSize = stats.size;
        const range = parseByteRange(req.headers.range, totalSize);

        if (range === 'unsatisfiable') {
          res.set('Content-Range', `bytes */${totalSize}`);
          res.set('Accept-Ranges', 'bytes');
          return res.status(416).send({
            error: 'Requested range not satisfiable',
            totalSize,
          });
        }

        if (range) {
          // True streaming: the slice goes straight from disk to the socket
          // and is never buffered whole in the process.
          res.status(206);
          res.set('Content-Type', 'text/plain; charset=utf-8');
          res.set('Content-Range', `bytes ${range.start}-${range.end}/${totalSize}`);
          res.set('Accept-Ranges', 'bytes');
          res.set('Content-Length', String(range.end - range.start + 1));
          const stream = fs.createReadStream(logFile, { start: range.start, end: range.end });
          stream.on('error', (streamErr) => {
            // Headers are already gone; all that is left is to cut the body.
            res.end();
            console.error('[SERVER] Cannot stream the log file |', streamErr);
          });
          return stream.pipe(res);
        }

        const start = totalSize > LOG_READ_MAX_BYTES ? totalSize - LOG_READ_MAX_BYTES : 0;
        if (totalSize === 0) {
          res.set('Accept-Ranges', 'bytes');
          return res.send({
            error: null,
            content: '',
            truncated: false,
            totalSize,
            returnedSize: 0,
            offset: 0,
          });
        }
        readFileWindow(logFile, start, totalSize - 1, (readErr, buffer) => {
          if (readErr) {
            return next(fileError(readErr, 'Log file not found', 'Cannot read the log file'));
          }
          res.set('Accept-Ranges', 'bytes');
          res.send({
            error: null,
            content: buffer.toString('utf8'),
            truncated: start > 0,
            totalSize,
            returnedSize: buffer.length,
            offset: start,
          });
        });
      });
    }
  );

  // Delete a specific log file
  router.delete(
    '/:fileName',
    validate({ params: { fileName: logFileNameParam } }),
    function (req, res, next) {
      const { fileName } = req.params;
      const logFile = resolveWithin(logsPath, fileName);
      if (!logFile) {
        return sendBadRequest(res, 'Invalid log file name');
      }
      deleteFile(logFile, (err) => {
        if (err) {
          next(fileError(err, 'Log file not found', 'Cannot delete the log file'));
        } else {
          res.send({
            error: null,
            result: true,
          });
        }
      });
    }
  );

  // Attached to the router itself as well as to the application: see the note
  // in `routes/model.js`.
  router.use(errorHandler);

  return router;
};

module.exports = createRouter;
// Exposed so callers (and tests) can reason against the documented cap.
module.exports.LOG_READ_MAX_BYTES = LOG_READ_MAX_BYTES;
