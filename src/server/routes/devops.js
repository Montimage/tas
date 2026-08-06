/* Working with Data Generator */
var express = require("express");
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
let logsPath = `${__dirname}/../logs/test-campaigns/`;

let runningStatus = null;

/**
 * Get the running status of test campaign
 */
router.get("/status", (req, res, next) => {
  if (runningStatus) runningStatus.isRunning = getTestCampainStatus() !== OFFLINE;
  res.send({
    runningStatus
  });
});

/**
 * A test campaign id is optional in the stored configuration, but when one is
 * present it is interpolated into a log filename, so it must survive the same
 * allowlist every other name-derived path in the API goes through.
 * @param {*} testCampaignId The value from the devops configuration
 * @returns {Boolean} true when the value is absent or safe to derive a name from
 */
const isValidTestCampaignId = (testCampaignId) =>
  testCampaignId === undefined ||
  testCampaignId === null ||
  isValidName(testCampaignId);

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

router.get("/", function (req, res, next) {
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
router.post("/", function (req, res, next) {
  const {
    devops
  } = req.body;
  if (!devops) {
    console.error("[SERVER]", "Cannot find devops content in body");
    return res.send({
      error: "Cannot find devops content in body"
    });
  }
  // The test campaign id becomes part of a log filename in GET /start, so a
  // hostile value must never reach the persisted configuration in the first
  // place. Validating only on read-back would still leave the escape sitting
  // in devops.json for any other consumer.
  if (!isValidTestCampaignId(devops.testCampaignId)) {
    return sendBadRequest(res, "Invalid test campaign id");
  }
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

router.get('/start', loadValidatedDevops, dbConnector, (req, res, next) => {
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

router.get('/stop', (req, res, next) => {
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