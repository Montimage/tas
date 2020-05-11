/* Working with Data Generator */
var express = require("express");
const {SIMULATING} = require('../../core/DeviceStatus');
const {
  readJSONFile,
  readTextFile,
  writeToFile,
  readDir,
  deleteFile,
} = require("../../core/utils");
const { startSimulator, stopSimulator, getStatsSimulator } = require("../../core/simulation");
const {
  startDataGenerator,
  stopDataGenerator,
  getStatsDataGenerator
} = require("../../core/data-generators");

const modelsPath = `${__dirname}/../models/`;

const createRouter = (isSimulation = true) => {
  let router = express.Router();
  let getLogger = require("../logger");
  let logsPath = `${__dirname}/../logs/simulation/`;
  let defaultModel = "simulation.json";
  let start = startSimulator;
  let stop = stopSimulator;
  let getStats = getStatsSimulator;

  if (!isSimulation) {
    logsPath = `${__dirname}/../logs/data-generator/`;
    defaultModel = "data-generator.json";
    start = startDataGenerator;
    stop = stopDataGenerator;
    getStats = getStatsDataGenerator;
  }

  ///////////////
  // MODEL
  ///////////////
  // Read a specific model by its name:
  router.get("/model", function (req, res, next) {
    const modelFile = `${modelsPath}${defaultModel}`;
    readJSONFile(modelFile, (err, data) => {
      if (err) {
        console.error("[SERVER]", err);
        res.send({
          error: "No default model",
          model: {
            name: "New Model",
            things: [],
          },
        });
      } else {
        res.send({ error: null, model: data });
      }
    });
  });

  // Save a model
  router.post("/model", function (req, res, next) {
    const { model } = req.body;
    if (!model) {
      console.error("[SERVER]", "Cannot find model in body");
      return res.send({ error: "Cannot find model in body" });
    }

    const { name, things } = model;
    if (!name || !things) {
      console.error("[SERVER]", `Invalid model ${JSON.stringify(model)}`);
      return res.send({ error: `Invalid model ${JSON.stringify(model)}` });
    }

    const modelFile = `${modelsPath}${defaultModel}`;
    writeToFile(modelFile, JSON.stringify(model), (err, data) => {
      if (err) {
        console.error("[SERVER]", err);
        res.send({ error: "Cannot save the new configuration" });
      } else {
        res.send({ error: null, model });
      }
    });
  });

  /////////////
  // LOG FILES
  /////////////
  // Get all the logs file
  router.get("/logs", (req, res, next) => {
    readDir(logsPath, (err, files) => {
      if (err) {
        console.error("[SERVER]", err);
        res.send({ error: "Cannot read the logs directory" });
      } else {
        res.send({ error: null, files });
      }
    });
  });

  // Read a specific log file
  router.get("/logs/:fileName", function (req, res, next) {
    const { fileName } = req.params;
    const logFile = `${logsPath}${fileName}`;
    readTextFile(logFile, (err, content) => {
      if (err) {
        console.error("[SERVER]", err);
        res.send({ error: "Cannot read the log file" });
      } else {
        res.send({ error: null, content });
      }
    });
  });

  // Delete a specific log file
  router.post("/logs/:fileName", function (req, res, next) {
    const { fileName } = req.params;
    const logFile = `${logsPath}${fileName}`;
    deleteFile(logFile, (err) => {
      if (err) {
        console.error("[SERVER]", err);
        res.send({ error: "Cannot delete the log file" });
      } else {
        res.send({ error: null, result: true });
      }
    });
  });

  /////////////
  // DEPLOY
  /////////////

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
  // Deploy a model
  router.post("/deploy", function (req, res, next) {
    const thingConfigs = req.body.model;
    // Check if the simulation is running
    if (deployStatus) {
      res.send({
        error: "A simulation is running. Only one simulation can be running",
      });
    } else {
      // Check if there is a configuration
      // Check if there is a configuration
      if (!thingConfigs) {
        console.error("[SERVER]", "Cannot simulate a null model");
        return res.send({
          error: "Cannot simulate a null model",
        });
      }
      const { name, things } = thingConfigs;
      if (!name || !things) {
        return res.send({ error: "Invalid model", model: thingConfigs });
      }

      const startedTime = Date.now();
      const logFile = `${name}_${Date.now()}.log`;
      getLogger("SIMULATOR", `${logsPath}${logFile}`);
      start(things);
      deployStatus = {
        model: thingConfigs.name,
        startedTime,
        logFile,
      };
      res.send({ error: null, model: thingConfigs, deployStatus });
    }
  });

  router.get("/stop", function (req, res, next) {
    const copiedStatus = deployStatus;
    if (deployStatus) {
      stop();
      deployStatus = null;
    }
    res.send({ error: null, deployStatus: copiedStatus });
  });
  let stats = null;
  router.get("/status", (req, res, next) => {
    stats = getStats();
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
    res.send({ error: null, deployStatus: isOffline ? null : deployStatus });
  });

  router.get("/stats", (req, res, next) => {
    res.send({ error: null, stats });
  });

  ///////////////
  // MULTI MODEL FILES
  ///////////////
  // Read the list of models
  router.get("/models", (req, res, next) => {
    readDir(modelsPath, (err, files) => {
      if (err) {
        console.error("[SERVER]", err);
        res.send({ error: "Cannot read the models directory" });
      } else {
        res.send({ error: null, files });
      }
    });
  });

  // Read a specific model by its name:
  router.get("/models/:fileName", function (req, res, next) {
    const { fileName } = req.params;
    const modelFile = `${modelsPath}${fileName}`;
    readJSONFile(modelFile, (err, data) => {
      if (err) {
        console.error("[SERVER]", err);
        res.send({ error: err });
      } else {
        res.send({ error: null, model: data });
      }
    });
  });

  // Save a model
  router.post("/models", function (req, res, next) {
    const { model } = req.body;
    if (!model) {
      console.error("[SERVER]", "Cannot find model in body");
      return res.send({ error: "Cannot find model in body" });
    }

    const { name, things } = model;
    if (!name || !things) {
      console.error("[SERVER]", `Invalid model ${JSON.stringify(model)}`);
      return res.send({ error: `Invalid model ${JSON.stringify(model)}` });
    }

    const modelFile = `${modelsPath}_${model.name}.json`;
    writeToFile(modelFile, JSON.stringify(model), (err, data) => {
      if (err) {
        console.error("[SERVER]", err);
        res.send({ error: "Cannot save the new configuration" });
      } else {
        res.send({ error: null, model: model });
      }
    });
  });

  // Delete a model
  router.post("/models/:fileName", function (req, res, next) {
    const { fileName } = req.params;
    const modelFile = `${modelsPath}${fileName}`;
    deleteFile(modelFile, (err) => {
      if (err) {
        console.error("[SERVER]", err);
        res.send({ error: "Cannot delete the model file" });
      } else {
        res.send({ error: null, result: true });
      }
    });
  });

  return router;
};

module.exports = createRouter;
