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
router.get('/', validate({ query: reportQuery }), dbConnector, async function (req, res, next) {
  let options = {};
  const { topologyFileName, testCampaignId } = req.query;
  if (topologyFileName) {
    options['topologyFileName'] = topologyFileName;
  }
  if (testCampaignId) {
    options['testCampaignId'] = testCampaignId;
  }

  try {
    const reports = await ReportSchema.findReportsWithOptions(options);
    res.send({
      reports,
    });
  } catch (err2) {
    next(databaseError(err2, 'Failed to get reports'));
  }
});

const updateReportScore = async (report, res, next) => {
  const { originalDatasetId, newDatasetId, startTime, endTime, score, _id, evaluationParameters } =
    report;
  let originalEvents;
  let newEvents;
  try {
    originalEvents = await EventSchema.findEventsBetweenTimes(
      { datasetId: originalDatasetId },
      startTime,
      endTime
    );
  } catch (err3) {
    return next(databaseError(err3, 'Cannot get the original events of the report'));
  }
  try {
    newEvents = await EventSchema.findEventsWithOptions({ datasetId: newDatasetId });
  } catch (err4) {
    return next(databaseError(err4, 'Cannot get the new events of the report'));
  }
  let newScore = score;
  if (evaluationParameters) {
    const { threshold, eventType, metricType } = evaluationParameters;
    newScore = evalulate(originalEvents, newEvents, eventType, metricType, threshold);
  } else {
    newScore = evalulate(originalEvents, newEvents);
  }
  // Going to save the score into the report
  try {
    const ret = await ReportSchema.findByIdAndUpdate(
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
      { returnDocument: 'after' }
    );
    console.log(`Report ${report._id} has score of ${newScore}`);
    res.send({
      report: ret,
    });
  } catch (err5) {
    next(databaseError(err5, 'Cannot update the score of the report'));
  }
};

/**
 * Get a event by id
 */
router.get(
  '/:reportId',
  validate({ params: { reportId: reportIdParam } }),
  dbConnector,
  async function (req, res, next) {
    const { reportId } = req.params;

    try {
      const report = await ReportSchema.findOne({ id: reportId });
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
    } catch (err2) {
      return next(databaseError(err2, 'Failed to get report'));
    }
  }
);

/**
 * Update a report
 */
router.post(
  '/:reportId',
  validate({ params: { reportId: reportIdParam }, body: reportBody }),
  dbConnector,
  async function (req, res, next) {
    const { report, newScore } = req.body;
    const { reportId } = req.params;
    try {
      const ts = await ReportSchema.findByIdAndUpdate(reportId, report, {
        returnDocument: 'after',
      });
      if (!ts) {
        return next(notFound('Report not found'));
      }
      if (!newScore) {
        return res.send({
          report: ts,
        });
      }
      return updateReportScore(ts, res, next);
    } catch (err) {
      return next(databaseError(err, 'Failed to save a report'));
    }
  }
);

/**
 * Delete a event by id
 */
router.delete(
  '/:reportId',
  validate({ params: { reportId: reportIdParam } }),
  dbConnector,
  async function (req, res, next) {
    const { reportId } = req.params;

    try {
      const ret = await ReportSchema.findByIdAndDelete(reportId);
      res.send({
        result: ret,
      });
    } catch (err) {
      next(databaseError(err, 'Failed to delete a report'));
    }
  }
);

// Attached to the router itself as well as to the application: see the note in
// `routes/model.js`.
router.use(errorHandler);

module.exports = router;
