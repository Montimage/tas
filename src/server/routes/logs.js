/* Working with Data Generator */
var express = require("express");
const path = require('path');
const {
  readTextFile,
  readDir,
  deleteFile,
} = require("../../core/utils");
const {
  resolveWithin,
  sendBadRequest,
} = require("./path-safety");
const {
  validate,
  fileNameParam,
  generatedFileNameMaxLength,
} = require("../middleware/validate");
const { errorHandler, fileError, internal } = require("../middleware/errors");

const _logsPath = `${__dirname}/../logs/`;

// ---------------------------------------------------------------------------
// Validation schemas for the log endpoints (issue #10)
// ---------------------------------------------------------------------------

// These routes address names the server generated, not names a caller supplied:
// a log is written as `${name}_${timestamp}.log`, so it is longer than the name
// it came from. Capping it like a plain derived filename would refuse to read or
// delete the logs the product itself writes.
const logFileNameParam = fileNameParam(".log", generatedFileNameMaxLength(".log"));

const createRouter = (appLog = true) => {
  let router = express.Router();
  let logsPath = `${_logsPath}${appLog}/`;

  /////////////
  // LOG FILES
  /////////////
  // Get all the logs file
  router.get("/", validate(), (req, res, next) => {
    readDir(logsPath, (err, files) => {
      if (err && err.code === "ENOENT") {
        // Nothing under the log root is created up front: a directory that does
        // not exist yet is an empty collection, not a missing resource. It is
        // the only listing in the API that can legitimately be absent.
        res.send({
          error: null,
          files: []
        });
      } else if (err) {
        next(internal("Cannot read the logs directory", err));
      } else {
        res.send({
          error: null,
          files: files.filter(f => path.extname(f) === '.log')
        });
      }
    });
  });

  // Read a specific log file
  router.get("/:fileName", validate({ params: { fileName: logFileNameParam } }), function (req, res, next) {
    const {
      fileName
    } = req.params;
    const logFile = resolveWithin(logsPath, fileName);
    if (!logFile) {
      return sendBadRequest(res, "Invalid log file name");
    }
    readTextFile(logFile, (err, content) => {
      if (err) {
        next(fileError(err, "Log file not found", "Cannot read the log file"));
      } else {
        res.send({
          error: null,
          content
        });
      }
    });
  });

  // Delete a specific log file
  router.delete("/:fileName", validate({ params: { fileName: logFileNameParam } }), function (req, res, next) {
    const {
      fileName
    } = req.params;
    const logFile = resolveWithin(logsPath, fileName);
    if (!logFile) {
      return sendBadRequest(res, "Invalid log file name");
    }
    deleteFile(logFile, (err) => {
      if (err) {
        next(fileError(err, "Log file not found", "Cannot delete the log file"));
      } else {
        res.send({
          error: null,
          result: true
        });
      }
    });
  });

  // Attached to the router itself as well as to the application: see the note
  // in `routes/model.js`.
  router.use(errorHandler);

  return router;
};

module.exports = createRouter;
