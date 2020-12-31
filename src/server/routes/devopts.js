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
} = require('../../core/devopts-flow');
let router = express.Router();
const devoptsFilePath = `${__dirname}/../data/devopts.json`;
let getLogger = require("../logger");
const {
  readJSONFile,
  writeToFile
} = require("../../core/utils");
const { OFFLINE } = require("../../core/DeviceStatus");
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

let _devopts = null;

const getDevopts = (callback) => {
  if (_devopts) return callback(null, _devopts);
  readJSONFile(devoptsFilePath, (err, data) => {
    if (err) {
      console.error('[SERVER] Cannot get devopts.json file', err);
      return callback(
        err
      );
    } else {
      _devopts = data;
      return callback(
        null,
        data
      );
    }
  });
};

router.get("/", function (req, res, next) {
  getDevopts((err, devO) => {
    if (err) {
      res.send({
        error: err
      });
    } else {
      res.send({
        devopts: devO
      });
    }
  });
});

// Save the default devopts
router.post("/", function (req, res, next) {
  const {
    devopts
  } = req.body;
  if (!devopts) {
    console.error("[SERVER]", "Cannot find devopts content in body");
    return res.send({
      error: "Cannot find devopts content in body"
    });
  }
  writeToFile(devoptsFilePath, JSON.stringify(devopts), (err, data) => {
    if (err) {
      console.error("[SERVER] Cannot save devopts.json file", err);
      res.send({
        error: "Cannot save devopts.json file"
      });
    } else {
      _devopts = devopts;
      res.send({
        devopts
      });
    }
  }, true);
});

router.get('/start', dbConnector, (req, res, next) => {
  getDevopts((err, devopts) => {
    if (err) {
      console.error('[SERVER] Cannot get devopts configuration');
      res.send({
        error: err
      });
    } else {
      const {
        webhookURL,
        testCampaignId,
        dataStorage
      } = devopts;
      if (!testCampaignId) {
        console.error('Test campaign Id must not be NULL');
        res.send({
          error: `Test campaign Id must not be null`
        });
      } else {
        const startedTime = Date.now();
        const logFile = `${testCampaignId}_${startedTime}.log`;
        getLogger("TEST-CAMPAIGN", `${logsPath}${logFile}`);
        console.log('[devopts] A test campaign is going to be started ...');

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
            devopts,
            runningStatus
          });
        } else {
          getDataStorage((err, ds) => {
            if (err) {
              console.log('[devopts] Cannot get data storage');
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