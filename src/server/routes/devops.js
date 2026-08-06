/* Working with Data Generator */
var express = require("express");
const Joi = require("joi");
const {
  dbConnector,
  getDataStorage,
} = require('./db-connector');
const {
  startTestCampaign,
  stopTestCampaign,
  getTestCampainStatus
} = require('../../core/devops-flow');
let router = express.Router();
const devopsFilePath = `${__dirname}/../data/devops.json`;
let getLogger = require("../logger");
const {
  readJSONFile,
  writeToFile
} = require("../../core/utils");
const { OFFLINE } = require("../../core/DeviceStatus");
const {
  isValidName,
  resolveWithin,
  sendBadRequest,
} = require("./path-safety");
const {
  validate,
  documentSchema,
  safeNameSchema,
  urlSchema,
  dataStorageSchema,
} = require("../middleware/validate");
let logsPath = `${__dirname}/../logs/test-campaigns/`;

let runningStatus = null;

// ---------------------------------------------------------------------------
// Validation schemas for the devops endpoints (issue #10)
// ---------------------------------------------------------------------------

// `testCampaignId` becomes part of a log filename, so it is held to the
// filename allowlist here rather than only where the path is derived. A
// configuration may carry no campaign at all, but an empty one is not the same
// thing as an absent one: it names no campaign and would interpolate into a
// filename as nothing, so `null` is accepted and `""` is not.
const devopsBody = Joi.object({
  devops: documentSchema({
    webhookURL: urlSchema.allow(null, ""),
    testCampaignId: safeNameSchema.allow(null),
    // Persisted, then handed to the test campaign flow, which builds a
    // `DataStorage` from it — the same sink a simulation's own connection
    // reaches, so it is held to the same shape.
    dataStorage: dataStorageSchema.allow(null),
    evaluationParameters: Joi.object().allow(null),
  }).required(),
}).required();

/**
 * Get the running status of test campaign
 */
router.get("/status", validate(), (req, res, next) => {
  if (runningStatus) runningStatus.isRunning = getTestCampainStatus() !== OFFLINE;
  res.send({
    runningStatus
  });
});

let _devops = null;

const getDevops = (callback) => {
  if (_devops) return callback(null, _devops);
  readJSONFile(devopsFilePath, (err, data) => {
    if (err) {
      console.error('[SERVER] Cannot get devops.json file', err);
      return callback(
        err
      );
    } else {
      _devops = data;
      return callback(
        null,
        data
      );
    }
  });
};

router.get("/", validate(), function (req, res, next) {
  getDevops((err, devO) => {
    if (err) {
      // Same reasoning as in `loadValidatedDevops` below: the raw fs error
      // carries the absolute path of devops.json in its own enumerable
      // properties, which JSON.stringify would serialise straight into the
      // response. Keep the detail server-side and answer with a constant.
      console.error('[SERVER] Cannot get devops configuration', err);
      res.send({
        error: "Cannot get devops configuration"
      });
    } else {
      res.send({
        devops: devO
      });
    }
  });
});

// Save the default devops
router.post("/", validate({ body: devopsBody }), function (req, res, next) {
  const {
    devops
  } = req.body;
  // The test campaign id becomes part of a log filename in GET /start, so a
  // hostile value must never reach the persisted configuration in the first
  // place. That is now the schema's job: `devopsBody` holds the id to the same
  // filename allowlist, so nothing hostile gets this far. The read-back guard
  // in `loadValidatedDevops` still stands, for configurations an older build
  // may have written.
  writeToFile(devopsFilePath, JSON.stringify(devops), (err, data) => {
    if (err) {
      console.error("[SERVER] Cannot save devops.json file", err);
      res.send({
        error: "Cannot save devops.json file"
      });
    } else {
      _devops = devops;
      res.send({
        devops
      });
    }
  }, true);
});

/**
 * Load the persisted devops configuration and reject it before any further
 * work when its test campaign id cannot safely derive a log filename.
 *
 * This runs ahead of `dbConnector` on purpose: the containment decision must
 * not depend on a reachable database, otherwise a hostile configuration is
 * only rejected on instances that happen to have one.
 */
const loadValidatedDevops = (req, res, next) => {
  getDevops((err, devops) => {
    if (err) {
      // The raw fs error carries the absolute path of devops.json in its own
      // enumerable properties, which JSON.stringify would serialise straight
      // into the response. Keep the detail server-side and answer with a
      // constant message.
      console.error('[SERVER] Cannot get devops configuration', err);
      return res.send({
        error: "Cannot get devops configuration"
      });
    }
    const { testCampaignId } = devops || {};
    if (!testCampaignId) {
      console.error('Test campaign Id must not be NULL');
      return res.send({
        error: `Test campaign Id must not be null`
      });
    }
    // A configuration written by an older, unvalidated build can still hold a
    // hostile id, so read-back is checked as well as write.
    if (!isValidName(testCampaignId)) {
      return sendBadRequest(res, "Invalid test campaign id");
    }
    req.devops = devops;
    return next();
  });
};

router.get('/start', validate(), loadValidatedDevops, dbConnector, (req, res, next) => {
  const devops = req.devops;
  const {
    webhookURL,
    testCampaignId,
    dataStorage,
    evaluationParameters,
  } = devops;
  const startedTime = Date.now();
  const logFile = `${testCampaignId}_${startedTime}.log`;
  // The logger creates missing parent directories, so an escaping filename
  // would write outside the log root rather than fail. Resolve and contain it.
  const logFilePath = resolveWithin(logsPath, logFile);
  if (!logFilePath) {
    return sendBadRequest(res, "Invalid test campaign id");
  }
  getLogger("TEST-CAMPAIGN", logFilePath);
  console.log('[devops] A test campaign is going to be started ...');

  if (dataStorage) {
    runningStatus = {
      isRunning: true,
      testCampaignId,
      dataStorage,
      webhookURL,
      startedTime,
      endTime: null,
      logFile
    };
    startTestCampaign(testCampaignId, dataStorage, webhookURL, evaluationParameters);
    res.send({
      error: null,
      devops,
      runningStatus
    });
  } else {
    getDataStorage((err, ds) => {
      if (err) {
        console.log('[devops] Cannot get data storage');
        res.send({
          error: 'Cannot get data storage'
        });
      } else {
        runningStatus = {
          isRunning: true,
          testCampaignId,
          dataStorage: ds,
          webhookURL,
          startedTime,
          endTime: null,
          logFile
        };
        startTestCampaign(testCampaignId, ds, webhookURL, evaluationParameters);
        res.send({
          error: null,
          runningStatus
        });
      }
    });
  }
});

router.get('/stop', validate(), (req, res, next) => {
  const copiedStatus = runningStatus;
  if (runningStatus) {
    stopTestCampaign();
    runningStatus = null;
    copiedStatus.isRunning = false;
  }
  res.send({
    error: null,
    runningStatus: copiedStatus
  });
});

module.exports = router;
