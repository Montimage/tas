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

// Pagination (F-PERF-004, issue #85): the list used to return every matching
// report. A page is `limit` records after `skip` records; the default page
// size keeps the unpaginated call of an older client bounded too.
const REPORTS_DEFAULT_PAGE_SIZE = 50;
const REPORTS_MAX_PAGE_SIZE = 500;

// Scoring reads events through the same bound (issue #31): a report whose
// window holds more events than this cap is scored over its first
// `MAX_SCORING_EVENTS` events in time order, so scoring memory stays
// proportional to the cap instead of to the run.
const MAX_SCORING_EVENTS = 10000;

// Both values are copied straight into the Mongo filter, so both are declared
// as strings and can never arrive as operator documents.
const reportQuery = Joi.object({
  topologyFileName: textSchema,
  testCampaignId: idSchema,
  limit: Joi.number()
    .integer()
    .min(1)
    .max(REPORTS_MAX_PAGE_SIZE)
    .default(REPORTS_DEFAULT_PAGE_SIZE),
  skip: Joi.number().integer().min(0).default(0),
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
  const { topologyFileName, testCampaignId, limit, skip } = req.query;
  if (topologyFileName) {
    options['topologyFileName'] = topologyFileName;
  }
  if (testCampaignId) {
    options['testCampaignId'] = testCampaignId;
  }

  try {
    const [reports, total] = await Promise.all([
      ReportSchema.findReportsWithOptions(options, { limit, skip }),
      ReportSchema.countDocuments(options),
    ]);
    // `total` lets a caller page without re-fetching; `limit`/`skip` echo the
    // page actually served. The `reports` array keeps its position and shape,
    // so a client written before pagination still reads the response.
    res.send({
      reports,
      total,
      limit,
      skip,
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
      endTime,
      MAX_SCORING_EVENTS
    );
  } catch (err3) {
    return next(databaseError(err3, 'Cannot get the original events of the report'));
  }
  try {
    newEvents = await EventSchema.findEventsWithOptions(
      { datasetId: newDatasetId },
      MAX_SCORING_EVENTS
    );
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
