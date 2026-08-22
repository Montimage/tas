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
router.get('/', validate(), dbConnector, async function (req, res, next) {
  try {
    const testCampaigns = await TestCampaignSchema.find();
    res.send({
      testCampaigns,
    });
  } catch (err2) {
    next(databaseError(err2, 'Failed to get test campaign'));
  }
});

// Add a new test campaign
router.post(
  '/',
  validate({ body: testCampaignCreateBody }),
  dbConnector,
  async function (req, res, next) {
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
    try {
      const _testCampaign = await newtestCampaign.save();
      res.send({
        testCampaign: _testCampaign,
      });
    } catch (err) {
      next(databaseError(err, 'Failed to save the test campaign'));
    }
  }
);

/**
 * Get a test campaign by id
 */
router.get(
  '/:testCampaignId',
  validate({ params: { testCampaignId: testCampaignIdParam } }),
  dbConnector,
  async function (req, res, next) {
    const { testCampaignId } = req.params;

    try {
      const testCampaign = await TestCampaignSchema.findOne({ id: testCampaignId });
      if (!testCampaign) {
        next(notFound('Test campaign not found'));
      } else {
        res.send({
          testCampaign,
        });
      }
    } catch (err2) {
      next(databaseError(err2, 'Failed to get test campaign'));
    }
  }
);

/**
 * Update a test campaign
 */
router.post(
  '/:testCampaignId',
  validate({ params: { testCampaignId: testCampaignIdParam }, body: testCampaignUpdateBody }),
  dbConnector,
  async function (req, res, next) {
    const { testCampaign } = req.body;
    const { testCampaignId } = req.params;

    try {
      const ts = await TestCampaignSchema.findOneAndUpdate({ id: testCampaignId }, testCampaign);
      res.send({
        testCampaign: ts,
      });
    } catch (err) {
      next(databaseError(err, 'Failed to save the test campaign'));
    }
  }
);

/**
 * Delete a test campaign by id
 */
router.delete(
  '/:testCampaignId',
  validate({ params: { testCampaignId: testCampaignIdParam } }),
  dbConnector,
  async function (req, res, next) {
    const { testCampaignId } = req.params;

    try {
      const ret = await TestCampaignSchema.findOneAndDelete({ id: testCampaignId });
      res.send({
        result: ret,
      });
    } catch (err) {
      next(databaseError(err, 'Failed to delete the test campaign'));
    }
  }
);

// Attached to the router itself as well as to the application: see the note in
// `routes/model.js`.
router.use(errorHandler);

module.exports = router;
