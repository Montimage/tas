/* Working with report */
const express = require("express");
const router = express.Router();
const { ReportSchema, dbConnector } = require("./db-connector");

// Get all the reports
router.get("/", dbConnector, function (req, res, next) {
  let options = {};
  const { topologyFileName, testCampaignId } = req.query;
  if (topologyFileName) {
    options["topologyFileName"] = topologyFileName;
  }
  if (testCampaignId) {
    options["testCampaignId"] = testCampaignId;
  }

  ReportSchema.findReportsWithOptions(options, (err2, reports) => {
    if (err2) {
      console.error("[SERVER] Failed to get reports");
      console.error(err2);
      res.send({
        error: "Failed to get reports",
      });
    } else {
      res.send({
        reports,
      });
    }
  });
});

/**
 * Get a event by id
 */
router.get("/:reportId", dbConnector, function (req, res, next) {
  const { reportId } = req.params;

  ReportSchema.findOne({id: reportId}, (err2, report) => {
    if (err2) {
      console.error("[SERVER] Failed to get reports");
      console.error(err2);
      res.send({
        error: "Failed to get report",
      });
    } else {
      res.send({
        report
      });
    }
  });
});

/**
 * Update a report
 */
router.post("/:reportId", dbConnector, function (req, res, next) {
  const { report } = req.body;
  const { reportId } = req.params;

  ReportSchema.findOneAndUpdate({id: reportId}, report, (err, ts) => {
    if (err) {
      console.error("[SERVER] Failed to save a report", err);
      res.send({
        error: "Failed to save a report",
      });
    } else {
      res.send({
        report: ts,
      });
    }
  });
});

/**
 * Delete a event by id
 */
router.delete("/:reportId", dbConnector, function (req, res, next) {
  const { reportId } = req.params;

  ReportSchema.findOneAndDelete({id: reportId}, (err, ret) => {
    if (err) {
      console.error("[SERVER] Failed to delete a report", err);
      res.send({
        error: "Failed to delete a report",
      });
    } else {
      res.send({
        result: ret,
      });
    }
  });
});

module.exports = router;
