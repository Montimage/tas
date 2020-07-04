/* Working with Test Case */
const express = require("express");
const router = express.Router();
const {
  TestCaseSchema,
  dbConnector
} = require('./db-connector');

// Get all the test cases
router.get("/", dbConnector, function (req, res, next) {
  TestCaseSchema.find((err2, testCases) => {
    if (err2) {
      console.error('[SERVER] Failed to get testcases', err2);
      res.send({
        error: 'Failed to get test case'
      });
    } else {
      res.send({
        testCases
      });
    }
  });
});

/**
 * Get a test case by id
 */
router.get("/:testCaseId", dbConnector, function (req, res, next) {
  const {
    testCaseId
  } = req.params;

  TestCaseSchema.findById(testCaseId, (err2, testCase) => {
    if (err2) {
      console.error('[SERVER] Failed to get testcases', err2);
      res.send({
        error: 'Failed to get test case'
      });
    } else {
      res.send({
        testCase
      });
    }
  });
});

// Add a new test case
router.post("/", dbConnector, function (req, res, next) {
  const {
    testCase
  } = req.body;
  const {
    id,
    name,
    tags,
    description,
    datasetIds
  } = testCase;
  const newTestCase = new TestCaseSchema({
    id,
    name,
    tags,
    description,
    datasetIds
  });
  newTestCase.save((err, _testCase) => {
    if (err) {
      console.error('[SERVER] Failed to save the test cases', err);
      res.send({
        error: 'Failed to save the test case'
      });
    } else {
      res.send({
        testCase: _testCase
      });
    }
  });
});

/**
 * Update a test case
 */
router.post("/:testCaseId", dbConnector, function (req, res, next) {
  const {
    testCase
  } = req.body;
  const {
    testCaseId
  } = req.params;

  TestCaseSchema.findByIdAndUpdate(testCaseId, testCase, (err, ts) => {
    if (err) {
      console.error('[SERVER] Failed to save the test cases', err);
      res.send({
        error: 'Failed to save the test case'
      });
    } else {
      res.send({
        testCase: ts
      });
    }
  });
});

/**
 * Delete a test case by id
 */
router.delete("/:testCaseId", dbConnector, function (req, res, next) {
  const {
    testCaseId
  } = req.params;

  TestCaseSchema.findByIdAndDelete(testCaseId, (err, ret) => {
    if (err) {
      console.error('[SERVER] Failed to save the test cases', err);
      res.send({
        error: 'Failed to save the test case'
      });
    } else {
      res.send({
        result: ret
      });
    }
  });
});

module.exports = router;