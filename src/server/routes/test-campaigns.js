/* Working with Test Campaign */
const express = require("express");
const router = express.Router();
const {
  TestCampaignSchema,
  dbConnector
} = require('./db-connector');

// Get all the test campaigns
router.get("/", dbConnector, function (req, res, next) {
  TestCampaignSchema.find((err2, testCampaigns) => {
    if (err2) {
      console.error('[SERVER] Failed to get testCampaigns', err2);
      res.send({
        error: 'Failed to get test campaign'
      });
    } else {
      res.send({
        testCampaigns
      });
    }
  });
});

// Add a new test campaign
router.post("/", dbConnector, function (req, res, next) {
  const {
    testCampaign
  } = req.body;
  const {
    id,
    name,
    isDefault,
    description,
    testCaseIds,
    webhookURL,
  } = testCampaign;
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
      console.error('[SERVER] Failed to save the test campaigns', err);
      res.send({
        error: 'Failed to save the test campaign'
      });
    } else {
      res.send({
        testCampaign: _testCampaign
      });
    }
  });
});

/**
 * Get a test campaign by id
 */
router.get("/:testCampaignId", dbConnector, function (req, res, next) {
  const {
    testCampaignId
  } = req.params;

  TestCampaignSchema.findById(testCampaignId, (err2, testCampaign) => {
    if (err2) {
      console.error('[SERVER] Failed to get testCampaigns', err2);
      res.send({
        error: 'Failed to get test campaign'
      });
    } else {
      res.send({
        testCampaign
      });
    }
  });
});

/**
 * Update a test campaign
 */
router.post("/:testCampaignId", dbConnector, function (req, res, next) {
  const {
    testCampaign
  } = req.body;
  const {
    testCampaignId
  } = req.params;

  TestCampaignSchema.findByIdAndUpdate(testCampaignId, testCampaign, (err, ts) => {
    if (err) {
      console.error('[SERVER] Failed to save the test campaigns', err);
      res.send({
        error: 'Failed to save the test campaign'
      });
    } else {
      res.send({
        testCampaign: ts
      });
    }
  });
});

/**
 * Delete a test campaign by id
 */
router.delete("/:testCampaignId", dbConnector, function (req, res, next) {
  const {
    testCampaignId
  } = req.params;

  TestCampaignSchema.findByIdAndDelete(testCampaignId, (err, ret) => {
    if (err) {
      console.error('[SERVER] Failed to save the test campaigns', err);
      res.send({
        error: 'Failed to save the test campaign'
      });
    } else {
      res.send({
        result: ret
      });
    }
  });
});

module.exports = router;