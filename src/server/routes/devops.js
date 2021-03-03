/* Working with Data Generator */
var express = require("express");
const { dbConnector, getDataStorage } = require("./db-connector");
const {
  startTestCampaign,
  stopTestCampaign,
  getTestCampainStatus,
} = require("../../core/devops-flow");
let router = express.Router();
const devopsFilePath = `${__dirname}/../data/devops.json`;
let getLogger = require("../logger");
const { readJSONFile, writeToFile } = require("../../core/utils");
const { OFFLINE } = require("../../core/DeviceStatus");
let logsPath = `${__dirname}/../logs/test-campaigns/`;

let runningStatus = null;

/**
 * Get the running status of test campaign
 */
router.get("/status", (req, res, next) => {
  if (runningStatus)
    runningStatus.isRunning = getTestCampainStatus() !== OFFLINE;
  res.send({
    runningStatus,
  });
});

let _devops = null;

const getDevops = (callback) => {
  if (_devops) return callback(null, _devops);
  readJSONFile(devopsFilePath, (err, data) => {
    if (err) {
      console.error("[SERVER] Cannot get devops.json file", err);
      _devops = {
        webhookURL: "http://your_dev_server_address/webhook",
        testCampaignId: null,
        evaluationParameters: {
          eventType: "ALL_EVENTS",
          metricType: "METRIC_VALUE_TIMESTAMP",
          threshold: 0.5,
        },
      };
      writeToFile(
        devopsFilePath,
        JSON.stringify(_devops),
        (err2, data) => {
          if (err2) {
            console.error("[SERVER] Cannot create devops.json file", err2);
            return callback({
              error: "Cannot create devops.json file",
            });
          } else {
            return callback(null,
              _devops
            );
          }
        },
        true
      );
    } else {
      _devops = data;
      return callback(null, data);
    }
  });
};

router.get("/", function (req, res, next) {
  getDevops((err, devO) => {
    if (err) {
      res.send({
        error: err,
      });
    } else {
      res.send({
        devops: devO,
      });
    }
  });
});

// Save the default devops
router.post("/", function (req, res, next) {
  const { devops } = req.body;
  if (!devops) {
    console.error("[SERVER]", "Cannot find devops content in body");
    return res.send({
      error: "Cannot find devops content in body",
    });
  }
  writeToFile(
    devopsFilePath,
    JSON.stringify(devops),
    (err, data) => {
      if (err) {
        console.error("[SERVER] Cannot save devops.json file", err);
        res.send({
          error: "Cannot save devops.json file",
        });
      } else {
        _devops = devops;
        res.send({
          devops,
        });
      }
    },
    true
  );
});

router.get("/start", dbConnector, (req, res, next) => {
  getDevops((err, devops) => {
    if (err) {
      console.error("[SERVER] Cannot get devops configuration");
      res.send({
        error: err,
      });
    } else {
      const {
        webhookURL,
        testCampaignId,
        dataStorage,
        evaluationParameters,
      } = devops;
      if (!testCampaignId) {
        console.error("Test campaign Id must not be NULL");
        res.send({
          error: `Test campaign Id must not be null`,
        });
      } else {
        const startedTime = Date.now();
        const logFile = `${testCampaignId}_${startedTime}.log`;
        getLogger("TEST-CAMPAIGN", `${logsPath}${logFile}`);
        console.log("[devops] A test campaign is going to be started ...");
        const reportToken = Date.now();
        if (dataStorage) {
          runningStatus = {
            isRunning: true,
            testCampaignId,
            reportToken,
            dataStorage,
            webhookURL,
            startedTime,
            endTime: null,
            logFile,
          };
          startTestCampaign(
            testCampaignId,
            dataStorage,
            webhookURL,
            evaluationParameters,
            reportToken
          );
          res.send({
            error: null,
            devops,
            runningStatus,
          });
        } else {
          getDataStorage((err, ds) => {
            if (err) {
              console.log("[devops] Cannot get data storage");
              res.send({
                error: "Cannot get data storage",
              });
            } else {
              runningStatus = {
                isRunning: true,
                testCampaignId,
                reportToken,
                dataStorage: ds,
                webhookURL,
                startedTime,
                endTime: null,
                logFile,
              };
              startTestCampaign(
                testCampaignId,
                ds,
                webhookURL,
                evaluationParameters,
                reportToken
              );
              res.send({
                error: null,
                runningStatus,
              });
            }
          });
        }
      }
    }
  });
});

router.get("/stop", (req, res, next) => {
  const copiedStatus = runningStatus;
  if (runningStatus) {
    stopTestCampaign();
    runningStatus = null;
    copiedStatus.isRunning = false;
  }
  res.send({
    error: null,
    runningStatus: copiedStatus,
  });
});

module.exports = router;
