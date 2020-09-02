/* Working with Data Generator */
var express = require("express");
const { SIMULATING } = require("../../core/DeviceStatus");
let getLogger = require("../logger");
const Simulation = require("../../core/simulation");
const { readJSONFile } = require("../../core/utils");

let router = express.Router();
const logsPath = `${__dirname}/../logs/simulations/`;
const modelsPath = `${__dirname}/../data/models/`;
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
let simulationStatus = null;
let simulation = null;
// Start simulating a model

const startSimulation = (model, options, res, modelFileName = null) => {
  // Check if there is a configuration
  if (!model) {
    console.error("[SERVER]", "Cannot simulate a null model");
    return res.send({
      error: "Cannot simulate a null model",
    });
  }
  const { name, devices } = model;
  if (!name || !devices) {
    return res.send({
      error: "Invalid model",
      model: model,
    });
  }

  const startedTime = Date.now();
  const logFile = `${name}_${Date.now()}.log`;
  getLogger("SIMULATION", `${logsPath}${logFile}`);
  simulation = new Simulation(model, options);
  simulation.start();
  simulationStatus = {
    model: model.name,
    startedTime,
    logFile,
    datasetId: simulation.datasetId,
    newDataset: simulation.newDataset,
    modelFileName
  };
  res.send({
    model: model,
    simulationStatus,
  });
};

router.post("/start", function (req, res, next) {
  stats = null;
  simulationStatus = null;
  const { model, modelFileName, options } = req.body;
  // Check if the simulation is running
  if (simulationStatus) {
    res.send({
      error: "A simulation is running. Only one simulation can be running",
    });
  } else {
    if (modelFileName) {
      const modelFilePath = `${modelsPath}${modelFileName}`;
      readJSONFile(modelFilePath, (err, myModel) => {
        if (err) {
          console.error(`Cannot read model ${modelFileName}`, err);
          res.send({ error: `Cannot read model ${modelFileName}` });
        } else {
          startSimulation(myModel, options, res, modelFileName);
        }
      });
    } else {
      startSimulation(model, options, res);
    }
  }
});

router.get("/stop", function (req, res, next) {
  const copiedStatus = simulationStatus;
  if (simulationStatus && simulation) {
    simulation.stop();
    simulationStatus = null;
  }
  res.send({
    error: null,
    simulationStatus: copiedStatus,
  });
});

router.get("/status", (req, res, next) => {
  if (!simulation) return res.send({ error: null, simulationStatus: null });
  stats = simulation.getStats();
  let isOffline = true;
  if (stats) {
    for (let index = 0; index < stats.length; index++) {
      const thing = stats[index];
      if (thing.status === SIMULATING) {
        isOffline = false;
        break;
      }
    }
  }
  res.send({
    error: null,
    simulationStatus: isOffline ? null : simulationStatus,
  });
});

router.get("/stats", (req, res, next) => {
  if (!simulation) return res.send({ error: null, stats: null });
  stats = simulation.getStats();
  res.send({
    error: null,
    stats,
  });
});

module.exports = router;
