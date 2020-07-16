/* Working with Data Generator */
var express = require("express");
const {
  SIMULATING
} = require('../../core/DeviceStatus');

const {
  startSimulator,
  stopSimulator,
  getStatsSimulator
} = require("../../core/simulation");

let router = express.Router();
let getLogger = require("../logger");
let logsPath = `${__dirname}/../logs/simulations/`;

/**
 * ```javascript
//Init
null
// Running
{
    isRunning: true,
    modelName: 'myModel',
    startedTime: 1234334242
    stoppedTime:
    logFile: 'myModel_1234334242.log'
}
// Stopped
{
    isRunning: false,
    modelName: 'myModel',
    startedTime: 1234334242
    stoppedTime: 1234344242
    logFile: 'myModel_1234334242.log'
}
```
 */
let deployStatus = null;
let stats = null;
// Start simulating a model
router.post("/start", function (req, res, next) {
  stats = null;
  deployStatus = null;
  const {
    model, options
  } = req.body;
  // Check if the simulation is running
  if (deployStatus) {
    res.send({
      error: "A simulation is running. Only one simulation can be running",
    });
  } else {
    // Check if there is a configuration
    if (!model) {
      console.error("[SERVER]", "Cannot simulate a null model");
      return res.send({
        error: "Cannot simulate a null model",
      });
    }
    const {
      name,
      devices
    } = model;
    if (!name || !devices) {
      return res.send({
        error: "Invalid model",
        model: model
      });
    }

    const startedTime = Date.now();
    const logFile = `${name}_${Date.now()}.log`;
    getLogger("SIMULATION", `${logsPath}${logFile}`);
    startSimulator(model, options);
    deployStatus = {
      model: model.name,
      startedTime,
      logFile,
    };
    res.send({
      error: null,
      model: model,
      deployStatus
    });
  }
});

router.get("/stop", function (req, res, next) {
  const copiedStatus = deployStatus;
  if (deployStatus) {
    stopSimulator();
    deployStatus = null;
  }
  res.send({
    error: null,
    deployStatus: copiedStatus
  });
});

router.get("/status", (req, res, next) => {
  stats = getStatsSimulator();
  let isOffline = true;
  if (stats) {
    for (let index = 0; index < stats.length; index++) {
      const thing = stats[index];
      if (thing.status === SIMULATING) {
        isOffline = false;
        break;
      };
    }
  }
  res.send({
    error: null,
    deployStatus: isOffline ? null : deployStatus
  });
});

router.get("/stats", (req, res, next) => {
  res.send({
    error: null,
    stats
  });
});

module.exports = router;
