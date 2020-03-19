/* Working with Data Generator */
var express = require("express");
var router = express.Router();
const {
  readJSONFile,
  readTextFile,
  writeToFile,
  readDir,
  deleteFile
} = require("../../../utils");
const { startSimulation, stopSimulation } = require("../../../things");
const getLogger = require("../logger");

const configFilePath = `${__dirname}/../data/simulation.json`;
const logFilePath = `${__dirname}/../logs/simulations/`;

router.get("/logs", (req, res, next) => {
  readDir(logFilePath, (err, files) => {
    if (err) {
      console.error("[SERVER]", err);
      res.send({ error: "Cannot read the logs directory" });
    } else {
      res.send({ error: null, files });
    }
  });
});

router.get("/logs/:fileName", function(req, res, next) {
  const { fileName } = req.params;
  const logFile = `${logFilePath}${fileName}`;
  readTextFile(logFile, (err, content) => {
    if (err) {
      console.error("[SERVER]", err);
      res.send({ error: "Cannot read the log file" });
    } else {
      res.send({ error: null, content });
    }
  });
});

router.post("/logs/:fileName", function(req, res, next) {
  const { fileName } = req.params;
  const logFile = `${logFilePath}${fileName}`;
  deleteFile(logFile, err => {
    if (err) {
      console.error("[SERVER]", err);
      res.send({ error: "Cannot delete the log file" });
    } else {
      res.send({ error: null, result: true });
    }
  });
});

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

router.get("/run", function(req, res, next) {
  if (deployStatus) {
    return res.send({
      error: "A simulation is running. Only one simulation can be running"
    });
  }

  readJSONFile(configFilePath, (err, thingConfigs) => {
    if (err) {
      console.error("[SERVER]", err);
      res.send({ error: "Cannot read the configuration file" });
    } else {
      // Check if there is a configuration
      if (thingConfigs) {
        // Logger
        const { name, things } = thingConfigs;
        if (!name || !things) {
          res.send({ error: "Invalid model", model: thingConfigs });
        } else {
          const startedTime = Date.now();
          const logFile = `${name}_${Date.now()}.log`;
          getLogger("Simulation", `${logFilePath}${logFile}`);
          startSimulation(things);
          deployStatus = {
            model: thingConfigs.name,
            startedTime,
            logFile
          };
          res.send({ error: null, model: thingConfigs, deployStatus });
        }
      } else {
        res.send({
          error: "Cannot simulate a null model"
        });
      }
    }
  });
});

router.post("/execute", function(req, res, next) {
  const thingConfigs = req.body.model;
  // Check if the simulation is running
  if (deployStatus) {
    res.send({
      error: "A simulation is running. Only one simulation can be running"
    });
  } else {
    // Check if there is a configuration
    if (thingConfigs) {
      // Logger
      const { name, things } = thingConfigs;
      if (!name || !things) {
        res.send({ error: "Invalid model", model: thingConfigs });
      } else {
        const startedTime = Date.now();
        const logFile = `${name}_${Date.now()}.log`;
        getLogger("Simulation", `${logFilePath}${logFile}`);
        startSimulation(things);
        deployStatus = {
          model: thingConfigs.name,
          startedTime,
          logFile
        };
        res.send({ error: null, model: thingConfigs, deployStatus });
      }
    } else {
      console.error("[SERVER]", err);
      res.send({
        error: "Cannot simulate a null model"
      });
    }
  }
});

router.get("/stop", function(req, res, next) {
  const copiedStatus = deployStatus;
  if (deployStatus) {
    stopSimulation();
    deployStatus = null;
  }
  res.send({ error: null, deployStatus: copiedStatus });
});

router.get("/status", (req, res, next) => {
  res.send({ error: null, deployStatus });
});

router.get("/", function(req, res, next) {
  readJSONFile(configFilePath, (err, data) => {
    if (err) {
      console.error("[SERVER]", err);
      res.send({ error: err });
    } else {
      res.send({ error: null, model: data });
    }
  });
});

router.post("/", (req, res, next) => {
  const newConfig = req.body.model;
  if (newConfig) {
    writeToFile(configFilePath, JSON.stringify(newConfig), (err, data) => {
      if (err) {
        console.error("[SERVER]", err);
        res.send({ error: "Cannot save the new configuration" });
      } else {
        res.send({ error: null, model: newConfig });
      }
    });
  } else {
    res.send({ error: "Invalid configuration!" });
  }
});

module.exports = router;
