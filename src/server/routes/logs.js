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
} = require("../middleware/validate");

const _logsPath = `${__dirname}/../logs/`;

// ---------------------------------------------------------------------------
// Validation schemas for the log endpoints (issue #10)
// ---------------------------------------------------------------------------

const logFileNameParam = fileNameParam(".log");

const createRouter = (appLog = true) => {
  let router = express.Router();
  let logsPath = `${_logsPath}${appLog}/`;

  /////////////
  // LOG FILES
  /////////////
  // Get all the logs file
  router.get("/", validate(), (req, res, next) => {
    readDir(logsPath, (err, files) => {
      if (err) {
        console.error("[SERVER]", err);
        res.send({
          error: "Cannot read the logs directory"
        });
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
        console.error("[SERVER]", err);
        res.send({
          error: "Cannot read the log file"
        });
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
        console.error("[SERVER]", err);
        res.send({
          error: "Cannot delete the log file"
        });
      } else {
        res.send({
          error: null,
          result: true
        });
      }
    });
  });

  return router;
};

module.exports = createRouter;
