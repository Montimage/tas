/* Working with Test Campaign */
const express = require('express');
const Joi = require('joi');
const router = express.Router();
const { TestCampaignSchema, dbConnector } = require('./db-connector');
const {
  validate,
  documentSchema,
  idSchema,
  textSchema,
  urlSchema,
} = require('../middleware/validate');
const { errorHandler, databaseError, notFound } = require('../middleware/errors');

// ---------------------------------------------------------------------------
// Validation schemas for the test-campaign endpoints (issue #10)
// ---------------------------------------------------------------------------

const testCampaignIdParam = idSchema.required();

const testCampaignFields = {
  id: idSchema,
  name: textSchema,
  isDefault: Joi.boolean(),
  description: textSchema.allow(null, ''),
  testCaseIds: Joi.array().items(Joi.string().max(256)),
  webhookURL: urlSchema.allow(null, ''),
};

const testCampaignCreateBody = Joi.object({
  testCampaign: documentSchema({
    ...testCampaignFields,
    id: idSchema.required(),
  }).required(),
}).required();

const testCampaignUpdateBody = Joi.object({
  testCampaign: documentSchema(testCampaignFields).required(),
}).required();

// Get all the test campaigns
router.get('/', validate(), dbConnector, function (req, res, next) {
  TestCampaignSchema.find((err2, testCampaigns) => {
    if (err2) {
      next(databaseError(err2, 'Failed to get test campaign'));
    } else {
      res.send({
        testCampaigns,
      });
    }
  });
});

// Add a new test campaign
router.post(
  '/',
  validate({ body: testCampaignCreateBody }),
  dbConnector,
  function (req, res, next) {
    const { testCampaign } = req.body;
    const { id, name, isDefault, description, testCaseIds, webhookURL } = testCampaign;
    const newtestCampaign = new TestCampaignSchema({
      id,
      name,
      isDefault,
      description,
      testCaseIds,
      webhookURL,
    });
    newtestCampaign.save((err, _testCampaign) => {
      if (err) {
        next(databaseError(err, 'Failed to save the test campaign'));
      } else {
        res.send({
          testCampaign: _testCampaign,
        });
      }
    });
  }
);

/**
 * Get a test campaign by id
 */
router.get(
  '/:testCampaignId',
  validate({ params: { testCampaignId: testCampaignIdParam } }),
  dbConnector,
  function (req, res, next) {
    const { testCampaignId } = req.params;

    TestCampaignSchema.findOne({ id: testCampaignId }, (err2, testCampaign) => {
      if (err2) {
        next(databaseError(err2, 'Failed to get test campaign'));
      } else if (!testCampaign) {
        next(notFound('Test campaign not found'));
      } else {
        res.send({
          testCampaign,
        });
      }
    });
  }
);

/**
 * Update a test campaign
 */
router.post(
  '/:testCampaignId',
  validate({ params: { testCampaignId: testCampaignIdParam }, body: testCampaignUpdateBody }),
  dbConnector,
  function (req, res, next) {
    const { testCampaign } = req.body;
    const { testCampaignId } = req.params;

    TestCampaignSchema.findOneAndUpdate({ id: testCampaignId }, testCampaign, (err, ts) => {
      if (err) {
        next(databaseError(err, 'Failed to save the test campaign'));
      } else {
        res.send({
          testCampaign: ts,
        });
      }
    });
  }
);

/**
 * Delete a test campaign by id
 */
router.delete(
  '/:testCampaignId',
  validate({ params: { testCampaignId: testCampaignIdParam } }),
  dbConnector,
  function (req, res, next) {
    const { testCampaignId } = req.params;

    TestCampaignSchema.findOneAndDelete({ id: testCampaignId }, (err, ret) => {
      if (err) {
        next(databaseError(err, 'Failed to delete the test campaign'));
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
