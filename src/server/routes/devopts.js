/* Working with Data Generator */
var express = require("express");
const {
  dbConnector,
  getDataStorage,
} = require('./db-connector');
const {
  startTestCampaign,
  stopTestCampaign
} = require('../../core/devOpts-flow');
let router = express.Router();
const devOptsFilePath = `${__dirname}/../data/devOpts.json`;
let getLogger = require("../logger");
const {
  readJSONFile,
  writeToFile
} = require("../../core/utils");
let logsPath = `${__dirname}/../logs/test-campaigns/`;

let runningStatus = null;

/**
 * Get the running status of test campaign
 */
router.get("/status", (req, res, next) => {
  res.send({
    runningStatus
  });
});

let _devOpts = null;

const getDevOpts = (callback) => {
  if (_devOpts) return callback(null, _devOpts);
  readJSONFile(devOptsFilePath, (err, data) => {
    if (err) {
      console.error('[SERVER] Cannot get devOpts.json file', err);
      return callback(
        err
      );
    } else {
      _devOpts = data;
      return callback(
        null,
        data
      );
    }
  });
};

router.get("/", function (req, res, next) {
  getDevOpts((err, devO) => {
    if (err) {
      res.send({
        error: err
      });
    } else {
      res.send({
        devOpts: devO
      });
    }
  });
});

// Save the default devOpts
router.post("/", function (req, res, next) {
  const {
    devOpts
  } = req.body;
  if (!devOpts) {
    console.error("[SERVER]", "Cannot find devOpts content in body");
    return res.send({
      error: "Cannot find devOpts content in body"
    });
  }
  writeToFile(devOptsFilePath, JSON.stringify(devOpts), (err, data) => {
    if (err) {
      console.error("[SERVER] Cannot save devOpts.json file", err);
      res.send({
        error: "Cannot save devOpts.json file"
      });
    } else {
      _devOpts = devOpts;
      res.send({
        devOpts
      });
    }
  }, true);
});

router.get('/start', dbConnector, (req, res, next) => {
  getDevOpts((err, devOpts) => {
    if (err) {
      console.error('[SERVER] Cannot get devOpts configuration');
      res.send({
        error: err
      });
    } else {
      const {
        webhookURL,
        testCampaignId,
        dataStorage
      } = devOpts;
      if (!testCampaignId) {
        console.error('Test campaign Id must not be NULL');
        res.send({
          error: `Test campaign Id must not be null`
        });
      } else {
        const startedTime = Date.now();
        const logFile = `${testCampaignId}_${startedTime}.log`;
        getLogger("TEST-CAMPAIGN", `${logsPath}${logFile}`);
        console.log('[devOpts] A test campaign is going to be started ...');

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
          startTestCampaign(testCampaignId, dataStorage, webhookURL);
          res.send({
            error: null,
            devOpts,
            runningStatus
          });
        } else {
          getDataStorage((err, ds) => {
            if (err) {
              console.log('[devOpts] Cannot get data storage');
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
              startTestCampaign(testCampaignId, ds, webhookURL);
              res.send({
                error: null,
                runningStatus
              });
            }
          });
        }
      }
    }
  });
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