/* Working with report */
const express = require('express');
const Joi = require('joi');
const {
  evalulate,
  ALL_EVENTS,
  METRIC_VALUE_TIMESTAMP,
  THRESHOLD_FLEXIBLE,
} = require('../../core/evaluation');
const router = express.Router();
const { EventSchema, ReportSchema, dbConnector } = require('./db-connector');
const { validate, documentSchema, idSchema, textSchema } = require('../middleware/validate');
const { errorHandler, databaseError, notFound } = require('../middleware/errors');

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
    testCampaignId: idSchema.allow(null, ''),
    originalDatasetId: idSchema.allow(null, ''),
    newDatasetId: idSchema.allow(null, ''),
    topologyFileName: textSchema.allow(null, ''),
    createdAt: Joi.number(),
    startTime: Joi.number(),
    endTime: Joi.number(),
    score: Joi.number(),
    evaluationParameters: Joi.object().allow(null),
  }),
  newScore: Joi.boolean(),
})
  .or('report', 'newScore')
  .required();

// Get all the reports
router.get('/', validate({ query: reportQuery }), dbConnector, function (req, res, next) {
  let options = {};
  const { topologyFileName, testCampaignId } = req.query;
  if (topologyFileName) {
    options['topologyFileName'] = topologyFileName;
  }
  if (testCampaignId) {
    options['testCampaignId'] = testCampaignId;
  }

  ReportSchema.findReportsWithOptions(options, (err2, reports) => {
    if (err2) {
      next(databaseError(err2, 'Failed to get reports'));
    } else {
      res.send({
        reports,
      });
    }
  });
});

const updateReportScore = (report, res, next) => {
  const { originalDatasetId, newDatasetId, startTime, endTime, score, _id, evaluationParameters } =
    report;
  EventSchema.findEventsBetweenTimes(
    { datasetId: originalDatasetId },
    startTime,
    endTime,
    (err3, originalEvents) => {
      if (err3) {
        next(databaseError(err3, 'Cannot get the original events of the report'));
      } else {
        EventSchema.findEventsWithOptions({ datasetId: newDatasetId }, (err4, newEvents) => {
          if (err4) {
            next(databaseError(err4, 'Cannot get the new events of the report'));
          } else {
            let newScore = score;
            if (evaluationParameters) {
              const { threshold, eventType, metricType } = evaluationParameters;
              newScore = evalulate(originalEvents, newEvents, eventType, metricType, threshold);
            } else {
              newScore = evalulate(originalEvents, newEvents);
            }
            // Going to save the score into the report
            ReportSchema.findByIdAndUpdate(
              _id,
              {
                score: newScore,
                evaluationParameters: evaluationParameters
                  ? evaluationParameters
                  : {
                      eventType: ALL_EVENTS,
                      metricType: METRIC_VALUE_TIMESTAMP,
                      threshold: THRESHOLD_FLEXIBLE,
                    },
              },
              { new: true },
              (err5, ret) => {
                if (err5) {
                  next(databaseError(err5, 'Cannot update the score of the report'));
                } else {
                  console.log(`Report ${report._id} has score of ${newScore}`);
                  res.send({
                    report: ret,
                  });
                }
              }
            );
          }
        });
      }
    }
  );
};

/**
 * Get a event by id
 */
router.get(
  '/:reportId',
  validate({ params: { reportId: reportIdParam } }),
  dbConnector,
  function (req, res, next) {
    const { reportId } = req.params;

    ReportSchema.findOne({ id: reportId }, (err2, report) => {
      if (err2) {
        return next(databaseError(err2, 'Failed to get report'));
      }
      if (!report) {
        return next(notFound('Report not found'));
      }
      const { score } = report;
      if (score > -1) {
        return res.send({
          report,
        });
      }
      return updateReportScore(report, res, next);
    });
  }
);

/**
 * Update a report
 */
router.post(
  '/:reportId',
  validate({ params: { reportId: reportIdParam }, body: reportBody }),
  dbConnector,
  function (req, res, next) {
    const { report, newScore } = req.body;
    const { reportId } = req.params;
    ReportSchema.findByIdAndUpdate(reportId, report, { new: true }, (err, ts) => {
      if (err) {
        return next(databaseError(err, 'Failed to save a report'));
      }
      if (!ts) {
        return next(notFound('Report not found'));
      }
      if (!newScore) {
        return res.send({
          report: ts,
        });
      }
      return updateReportScore(ts, res, next);
    });
  }
);

/**
 * Delete a event by id
 */
router.delete(
  '/:reportId',
  validate({ params: { reportId: reportIdParam } }),
  dbConnector,
  function (req, res, next) {
    const { reportId } = req.params;

    ReportSchema.findByIdAndDelete(reportId, (err, ret) => {
      if (err) {
        next(databaseError(err, 'Failed to delete a report'));
      } else {
        res.send({
          result: ret,
        });
      }
    });
  }
);

// Attached to the router itself as well as to the application: see the note in
// `routes/model.js`.
router.use(errorHandler);

module.exports = router;
