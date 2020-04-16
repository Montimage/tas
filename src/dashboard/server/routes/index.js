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
const { startSimulator, stopSimulator } = require("../../../simulation");
const { startDataGenerator, stopDataGenerator }  = require("../../../data-generators");
const getLogger = require("../logger");

const modelsPath = `${__dirname}/../models/`;
const logsPath = `${__dirname}/../logs/`;

///////////////
// MODEL FILES
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
// Model name: [TYPE]_name.json -> [TYPE]_ added automatically
router.get("/models/:fileName", function(req, res, next) {
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
router.post("/models", function(req, res, next) {
  const { model } = req.body;
  if (!model) {
    console.error("[SERVER]", "Cannot find model in body");
    return res.send({ error: "Cannot find model in body" });
  }

  const { type, name, things } = model;
  if (!name || !things || !type) {
    console.error("[SERVER]", `Invalid model ${JSON.stringify(model)}`);
    return res.send({ error: `Invalid model ${JSON.stringify(model)}` });
  }

  if (type !== 'SIMULATOR' && type !== 'DATA_GENERATOR') {
    console.error("[SERVER]", `Invalid model type ${type}`);
    return res.send({ error: `Invalid model type ${type}` });
  }

  const modelFile = `${modelsPath}${model.type}_${model.name}.json`;
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
router.post("/models/:fileName", function(req, res, next) {
  const { fileName } = req.params;
  const modelFile = `${modelsPath}${fileName}`;
  deleteFile(modelFile, err => {
    if (err) {
      console.error("[SERVER]", err);
      res.send({ error: "Cannot delete the model file" });
    } else {
      res.send({ error: null, result: true });
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
router.get("/logs/:fileName", function(req, res, next) {
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
router.post("/logs/:fileName", function(req, res, next) {
  const { fileName } = req.params;
  const logFile = `${logsPath}${fileName}`;
  deleteFile(logFile, err => {
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
    type: SIMULATOR,
    modelName: 'myModel',
    startedTime: 1234334242
    stoppedTime:
    logFile: 'myModel_1234334242.log'
}
// Stopped
{
    isRunning: false,
    type: SIMULATOR,
    modelName: 'myModel',
    startedTime: 1234334242
    stoppedTime: 1234344242
    logFile: 'myModel_1234334242.log'
}
```
 */
let deployStatus = null;
// Deploy a model
router.post("/deploy", function(req, res, next) {
  const thingConfigs = req.body.model;
  // Check if the simulation is running
  if (deployStatus) {
    res.send({
      error: "A simulation is running. Only one simulation can be running"
    });
  } else {
    // Check if there is a configuration
    // Check if there is a configuration
    if (!thingConfigs) {
      console.error("[SERVER]", "Cannot simulate a null model");
      return res.send({
        error: "Cannot simulate a null model"
      });
    }
    const { name, type, things } = thingConfigs;
    if (!name || !things) {
      return res.send({ error: "Invalid model", model: thingConfigs });
    }
    if (type !== "SIMULATOR" && type !== "DATA_GENERATOR") {
      console.error("[SERVER]",`Unsupported model type ${type}`);
      return res.send({ error: `Unsupported model type ${type}`, model: thingConfigs });
    }
    const startedTime = Date.now();
    const logFile = `${name}_${Date.now()}.log`;
    if (type === "SIMULATOR") {
      getLogger(type, `${logsPath}${logFile}`);
      startSimulator(things);
      deployStatus = {
        model: thingConfigs.name,
        startedTime,
        type,
        logFile
      };
    } else {
      getLogger(type, `${logsPath}${logFile}`);
      startDataGenerator(things);
      deployStatus = {
        model: thingConfigs.name,
        startedTime,
        type,
        logFile
      };
    }
    res.send({ error: null, model: thingConfigs, deployStatus });
  }
});

router.get("/stop", function(req, res, next) {
  const copiedStatus = deployStatus;
  if (deployStatus) {
    if (deployStatus.type === "SIMULATOR") {
      stopSimulator();
    } else {
      stopDataGenerator();
    }
    deployStatus = null;
  }
  res.send({ error: null, deployStatus: copiedStatus });
});

router.get("/status", (req, res, next) => {
  res.send({ error: null, deployStatus });
});

module.exports = router;
