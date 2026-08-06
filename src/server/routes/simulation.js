/* Working with Data Generator */
var express = require("express");
const Joi = require("joi");
const { SIMULATING, OFFLINE } = require("../../core/DeviceStatus");
let getLogger = require("../logger");
const Simulation = require("../../core/simulation");
const { readJSONFile } = require("../../core/utils");
const {
  isValidName,
  resolveWithin,
  sendBadRequest,
} = require("./path-safety");
const { getDataStorage } = require("./db-connector");
const { getObjectId } = require('../../core/utils');
const {
  validate,
  documentSchema,
  safeNameSchema,
  fileNameParam,
} = require("../middleware/validate");

let router = express.Router();
const logsPath = `${__dirname}/../logs/simulations/`;
const modelsPath = `${__dirname}/../data/models/`;

// ---------------------------------------------------------------------------
// Validation schemas for the simulation endpoints (issue #10)
// ---------------------------------------------------------------------------

// A simulation is keyed by its model file name, so `/stop` is given the same
// `.json` name the dashboard started it with.
const simulationFileNameParam = fileNameParam(".json");

const simulationModelBody = documentSchema({
  name: safeNameSchema.required(),
  devices: Joi.array().items(Joi.object()).required(),
  dataStorage: Joi.object(),
});

// A run starts either from a stored model or from an inline one.
const simulationStartBody = Joi.object({
  model: simulationModelBody,
  modelFileName: Joi.string().max(128),
  options: Joi.object(),
})
  .or("model", "modelFileName")
  .required();

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
  if (!isValidName(name)) {
    return sendBadRequest(res, "Invalid model name");
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

router.post("/start", validate({ body: simulationStartBody }), function (req, res, next) {
  stats = null;
  simulationStatus = null;
  const { model, modelFileName, options } = req.body;
  if (modelFileName) {
    const modelFilePath = resolveWithin(modelsPath, modelFileName);
    if (!modelFilePath) {
      return sendBadRequest(res, "Invalid model file name");
    }
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

router.get("/stop/:fileName", validate({ params: { fileName: simulationFileNameParam } }), function (req, res, next) {
  const { fileName } = req.params;
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
});

router.get("/status", validate(), (req, res, next) => {
  const keys = Object.keys(allSimulationStatus);
  for (let index = 0; index < keys.length; index++) {
    const key = keys[index];
    if (allSimulations[key]) {
      allSimulationStatus[key].isRunning = allSimulations[key].status !== OFFLINE;
    }
  }
  res.send({
    simulationStatus: allSimulationStatus
  });
});

router.get("/stats", validate(), (req, res, next) => {
  if (!simulation) return res.send({ error: null, stats: null });
  stats = simulation.getStats();
  res.send({
    error: null,
    stats,
  });
});

module.exports = router;
