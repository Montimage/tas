/* Working with report */
const express = require("express");
const Joi = require("joi");
const { evalulate, ALL_EVENTS, METRIC_VALUE_TIMESTAMP, THRESHOLD_FLEXIBLE } = require("../../core/evaluation");
const router = express.Router();
const { EventSchema, ReportSchema, dbConnector } = require("./db-connector");
const {
  validate,
  documentSchema,
  idSchema,
  textSchema,
} = require("../middleware/validate");

// ---------------------------------------------------------------------------
// Validation schemas for the report endpoints (issue #10)
// ---------------------------------------------------------------------------

const reportIdParam = idSchema.required();

// Both values are copied straight into the Mongo filter, so both are declared
// as strings and can never arrive as operator documents.
const reportQuery = Joi.object({
  topologyFileName: textSchema,
  testCampaignId: idSchema,
});

const reportBody = Joi.object({
  report: documentSchema({
    id: idSchema,
    testCampaignId: idSchema.allow(null, ""),
    originalDatasetId: idSchema.allow(null, ""),
    newDatasetId: idSchema.allow(null, ""),
    topologyFileName: textSchema.allow(null, ""),
    createdAt: Joi.number(),
    startTime: Joi.number(),
    endTime: Joi.number(),
    score: Joi.number(),
    evaluationParameters: Joi.object().allow(null),
  }),
  newScore: Joi.boolean(),
})
  .or("report", "newScore")
  .required();

// Get all the reports
router.get("/", validate({ query: reportQuery }), dbConnector, function (req, res, next) {
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
router.get("/:reportId", validate({ params: { reportId: reportIdParam } }), dbConnector, function (req, res, next) {
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
router.post("/:reportId", validate({ params: { reportId: reportIdParam }, body: reportBody }), dbConnector, function (req, res, next) {
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
router.delete("/:reportId", validate({ params: { reportId: reportIdParam } }), dbConnector, function (req, res, next) {
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
