/* Working with report */
const express = require("express");
const { evalulate, ALL_EVENTS, METRIC_VALUE_TIMESTAMP, THRESHOLD_FLEXIBLE } = require("../../core/evaluation");
const router = express.Router();
const { EventSchema, ReportSchema, dbConnector } = require("./db-connector");

// Get all the reports
router.get("/", dbConnector, function (req, res, next) {
  let options = {};
  const { topologyFileName, testCampaignId, reportToken } = req.query;
  if (topologyFileName) {
    options["topologyFileName"] = topologyFileName;
  }
  if (testCampaignId) {
    options["testCampaignId"] = testCampaignId;
  }
  if (reportToken) {
    options["reportToken"] = reportToken;
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

const updateReportScore = (report, res) => {
  const {
    originalDatasetId,
    newDatasetId,
    startTime,
    endTime,
    score,
    _id,
    evaluationParameters,
  } = report;
  EventSchema.findEventsBetweenTimes(
    { datasetId: originalDatasetId },
    startTime,
    endTime,
    (err3, originalEvents) => {
      if (err3) {
        res.send({
          error: `Cannot get original events of dataset ${originalDatasetId}`,
        });
      } else {
        EventSchema.findEventsWithOptions(
          { datasetId: newDatasetId },
          (err4, newEvents) => {
            if (err4) {
              res.send({
                error: `Cannot get new events of dataset ${newDatasetId}`,
              });
            } else {
              let newScore = score;
              if (evaluationParameters) {
                const {
                  threshold,
                  eventType,
                  metricType,
                } = evaluationParameters;
                newScore = evalulate(
                  originalEvents,
                  newEvents,
                  eventType,
                  metricType,
                  threshold
                );
              } else {
                newScore = evalulate(originalEvents, newEvents);
              }
              // Going to save the score into the report
              ReportSchema.findByIdAndUpdate(
                _id,
                { score: newScore,
                evaluationParameters: evaluationParameters ? evaluationParameters : {eventType: ALL_EVENTS, metricType: METRIC_VALUE_TIMESTAMP, threshold: THRESHOLD_FLEXIBLE} },
                {new: true},
                (err5, ret) => {
                  if (err5) {
                    console.error(
                      `Cannot update the score for report ${report._id}`
                    );
                    res.send({
                      error: `Cannot update the score for report ${report._id}`,
                    });
                  } else {
                    console.log(
                      `Report ${report._id} has score of ${newScore}`
                    );
                    res.send({
                      report: ret,
                    });
                  }
                }
              );
            }
          }
        );
      }
    }
  );
};

/**
 * Get a event by id
 */
router.get("/:reportId", dbConnector, function (req, res, next) {
  const { reportId } = req.params;

  ReportSchema.findOne({ id: reportId }, (err2, report) => {
    if (err2 || !report) {
      console.error("[SERVER] Failed to get reports");
      console.error(err2);
      return res.send({
        error: "Failed to get report",
      });
    }
    const { score } = report;
    if (score > -1) {
      return res.send({
        report,
      });
    }
    return updateReportScore(report, res);
  });
});

/**
 * Update a report
 */
router.post("/:reportId", dbConnector, function (req, res, next) {
  const { report, newScore } = req.body;
  const { reportId } = req.params;
  ReportSchema.findByIdAndUpdate(reportId, report, {new: true},(err, ts) => {
    if (err) {
      console.error("[SERVER] Failed to save a report", err);
      return res.send({
        error: "Failed to save a report",
      });
    }
    if (!newScore) {
      return res.send({
        report: ts,
      });
    }
    return updateReportScore(ts, res);
  });
});

/**
 * Delete a event by id
 */
router.delete("/:reportId", dbConnector, function (req, res, next) {
  const { reportId } = req.params;

  ReportSchema.findByIdAndDelete(reportId, (err, ret) => {
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
