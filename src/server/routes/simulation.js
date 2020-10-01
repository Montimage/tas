/* Working with Data Generator */
var express = require("express");
const { SIMULATING } = require("../../core/DeviceStatus");
let getLogger = require("../logger");
const Simulation = require("../../core/simulation");
const { readJSONFile } = require("../../core/utils");
const { getDataStorage } = require("./db-connector");
const { getObjectId } = require('../../core/utils');

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
let allSimulationStatus = {};
let allSimulations = {};
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

  const simId = getObjectId(name);
  if (allSimulations[simId] && allSimulations[simId].isRunning) {
    console.error(
      `[simulation] A running simulation is using this topology (${name}). A topology can be used only in one running simulation`
    );
    res.send({
      error:
        "A running simulation is using this topology. A topology can be used only in one running simulation",
    });
  } else {
    const startedTime = Date.now();
    const logFile = `${name}_${Date.now()}.log`;
    getLogger("SIMULATION", `${logsPath}${logFile}`);
    if (!model.dataStorage && !options.dataStorage) {
      // Use default data storage
      getDataStorage((err, ds) => {
        if (err) {
          res.send({ error: "No data storage" });
        } else {
          const simulation = new Simulation(
            { ...model, dataStorage: ds },
            options
          );
          simulation.start();
          allSimulations[simId] = simulation;
          allSimulationStatus[simId] = {
            model: model.name,
            startedTime,
            logFile,
            datasetId: simulation.datasetId,
            newDataset: simulation.newDataset,
            report: simulation.report,
            modelFileName,
            isRunning: true
          };

          res.send({
            model: model,
            simulationStatus: allSimulationStatus,
          });
        }
      });
    } else {
      const simulation = new Simulation(model, options);
      simulation.start();
      allSimulations[simId] = simulation;
      allSimulationStatus[simId] = {
        model: model.name,
        startedTime,
        logFile,
        datasetId: simulation.datasetId,
        newDataset: simulation.newDataset,
        report: simulation.report,
        modelFileName,
        isRunning: true,
      };

      res.send({
        model: model,
        simulationStatus: allSimulationStatus,
      });
    }
  }
};

router.post("/start", function (req, res, next) {
  stats = null;
  simulationStatus = null;
  const { model, modelFileName, options } = req.body;
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
});

router.get("/stop/:fileName", function (req, res, next) {
  const { fileName } = req.params;
  if (!fileName) {
    console.error(`[simulation] Missing topology's name`);
    res.send({
      error: "Missing topology's name",
      simulationStatus: allSimulationStatus,
    });
  } else {
    const simId = getObjectId(fileName.replace(".json", ""));
    if (allSimulations[simId]) {
      allSimulations[simId].stop();
      allSimulations[simId] = null;
    }
    if (allSimulationStatus[simId]) {
      allSimulationStatus[simId].isRunning = false;
      allSimulationStatus[simId].endTime = Date.now();
    }
    res.send({
      error: null,
      simulationStatus: allSimulationStatus,
    });
  }
});

router.get("/status", (req, res, next) => {
  res.send({
    simulationStatus: allSimulationStatus
  });
  // if (!simulation) return res.send({ error: null, simulationStatus: null });
  // stats = simulation.getStats();
  // let isOffline = true;
  // if (stats) {
  //   for (let index = 0; index < stats.length; index++) {
  //     const thing = stats[index];
  //     if (thing.status === SIMULATING) {
  //       isOffline = false;
  //       break;
  //     }
  //   }
  // }
  // res.send({
  //   error: null,
  //   simulationStatus: isOffline ? null : simulationStatus,
  // });
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
