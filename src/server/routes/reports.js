/* Working with Data Generator */
var express = require("express");
const path = require('path');
const {
  readTextFile,
  readDir,
  deleteFile,
} = require("../../core/utils");

const _reportsPath = `${__dirname}/../reports/`;

const createRouter = (appLog = true) => {
  let router = express.Router();
  let reportsPath = `${_reportsPath}${appLog}/`;

  /////////////
  // REPORT FILES
  /////////////
  // Get all the reports file
  router.get("/", (req, res, next) => {
    readDir(reportsPath, (err, files) => {
      if (err) {
        console.error("[SERVER]", err);
        res.send({
          error: "Cannot read the reports directory"
        });
      } else {
        res.send({
          error: null,
          files
        });
      }
    });
  });

  // Read a specific report file
  router.get("/:fileName", function (req, res, next) {
    const {
      fileName
    } = req.params;
    const reportFile = `${reportsPath}${fileName}`;
    readTextFile(reportFile, (err, content) => {
      if (err) {
        console.error("[SERVER]", err);
        res.send({
          error: "Cannot read the report file"
        });
      } else {
        res.send({
          error: null,
          content
        });
      }
    });
  });

  // Delete a specific report file
  router.delete("/:fileName", function (req, res, next) {
    const {
      fileName
    } = req.params;
    const reportFile = `${reportsPath}${fileName}`;
    deleteFile(reportFile, (err) => {
      if (err) {
        console.error("[SERVER]", err);
        res.send({
          error: "Cannot delete the report file"
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