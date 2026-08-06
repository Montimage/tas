/* Working with Test Case */
const express = require("express");
const router = express.Router();
const modelsPath = `${__dirname}/../data/models/`;
const {
  TestCaseSchema,
  dbConnector
} = require('./db-connector');
const {
  resolveWithin,
  sendBadRequest,
} = require("./path-safety");

/**
 * Contain the `modelFileName` a request wants stored on a test case.
 *
 * The stored value is an absolute path into the models directory that a later
 * consumer may open, so it is resolved and checked for containment before it
 * is persisted - a rejected name never reaches the database. An absent name is
 * stored as null rather than a path to a file that cannot exist.
 *
 * Runs ahead of `dbConnector` so the check does not depend on a reachable
 * database, and so a hostile request costs no connection attempt.
 */
const containModelFileName = (req, res, next) => {
  const { testCase } = req.body || {};
  if (!testCase || typeof testCase !== "object") {
    // Shape errors stay the responsibility of the handler below.
    return next();
  }
  // A `$`-prefixed key makes the body a MongoDB update document rather than a
  // plain set of fields, and the update route hands it to `findOneAndUpdate`
  // as-is. `{"$set": {"modelFileName": "..."}}` carries no own `modelFileName`
  // key, so the containment below would wave it through and the operator would
  // still persist an arbitrary path. No legitimate client sends operators - the
  // UI posts a flat object of form fields - so reject them outright.
  if (Object.keys(testCase).some((key) => key.startsWith("$"))) {
    return sendBadRequest(res, "Invalid test case");
  }
  if (!("modelFileName" in testCase)) {
    return next();
  }
  const { modelFileName } = testCase;
  if (modelFileName === undefined || modelFileName === null || modelFileName === "") {
    req.containedModelFileName = null;
    return next();
  }
  const modelFilePath = resolveWithin(modelsPath, modelFileName);
  if (!modelFilePath) {
    return sendBadRequest(res, "Invalid model file name");
  }
  req.containedModelFileName = modelFilePath;
  return next();
};

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

  TestCaseSchema.findOne({id: testCaseId}, (err2, testCase) => {
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
router.post("/", containModelFileName, dbConnector, function (req, res, next) {
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
    datasetIds,
    modelFileName: req.containedModelFileName || null
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
router.post("/:testCaseId", containModelFileName, dbConnector, function (req, res, next) {
  const {
    testCase
  } = req.body;
  const {
    testCaseId
  } = req.params;

  // Without this the create-time containment above is bypassable in one extra
  // request: the update writes whatever the body carries straight through.
  // `undefined` means the payload carried no modelFileName at all, so the
  // stored one is left alone; `null` is a contained value the caller asked for.
  const update = req.containedModelFileName !== undefined
    ? { ...testCase, modelFileName: req.containedModelFileName }
    : testCase;

  TestCaseSchema.findOneAndUpdate({id: testCaseId}, update, (err, ts) => {
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

  TestCaseSchema.findOneAndDelete({id: testCaseId}, (err, ret) => {
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