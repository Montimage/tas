/* Working with Data Generator */
var express = require('express');
const Joi = require('joi');
const { OFFLINE } = require('../../core/DeviceStatus');
let getLogger = require('../logger');
const Simulation = require('../../core/simulation');
const { readJSONFile } = require('../../core/utils');
const { isValidName, resolveWithin, sendBadRequest } = require('./path-safety');
const { getDataStorage } = require('./db-connector');
const { getObjectId } = require('../../core/utils');
const {
  validate,
  documentSchema,
  safeNameSchema,
  fileNameParam,
  fileNameMaxLength,
  simulationRunFields,
} = require('../middleware/validate');
const {
  errorHandler,
  badRequest,
  conflict,
  fileError,
  unavailable,
} = require('../middleware/errors');

let router = express.Router();
const logsPath = `${__dirname}/../logs/simulations/`;
const modelsPath = `${__dirname}/../data/models/`;

// ---------------------------------------------------------------------------
// Validation schemas for the simulation endpoints (issue #10)
// ---------------------------------------------------------------------------

// A simulation is keyed by its model file name, so `/stop` is given the same
// `.json` name the dashboard started it with.
const simulationFileNameParam = fileNameParam('.json');

const simulationModelBody = documentSchema({
  name: safeNameSchema.required(),
  devices: Joi.array().items(Joi.object()).required(),
  // A stored topology carries many fields beyond these, so unknown keys still
  // pass — but not the run-configuration ones, which reach the filters and the
  // connection described where they are declared. The same spread guards the
  // model persistence route, so a topology cannot be stored with shapes this
  // route would have refused.
  ...simulationRunFields,
});

// A run starts either from a stored model or from an inline one.
const simulationStartBody = Joi.object({
  model: simulationModelBody,
  modelFileName: Joi.string().max(fileNameMaxLength('.json')),
  // Unknown keys are rejected here rather than tolerated: unlike a stored
  // topology, `options` is assembled by the caller for this one request, so
  // there is no round-tripped field to make room for. Defaulted because the
  // handler dereferences it: a request that omits it entirely must still leave
  // an object behind, not an undefined the run would crash on.
  options: Joi.object(simulationRunFields).default({}),
})
  .or('model', 'modelFileName')
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
// The ids whose start is under way. On the default data storage path the run is
// only registered inside the `getDataStorage` callback, an event-loop turn after
// the guard below read the registry, so without something held across that turn
// two concurrent starts of one topology both pass the guard and the first run is
// left publishing with no handle to stop it. A reservation rather than a
// placeholder in `allSimulations`: `/stop` calls `stop()` on whatever it finds
// there.
const startingSimulations = new Set();
// The logger of each running simulation, held here so `/stop` can release the
// run's file handle once the run stops. The logger is passed explicitly to the
// run; global console methods are never touched.
const runLoggers = {};
// Start simulating a model

const startSimulation = (model, options = {}, res, next, modelFileName = null) => {
  // Check if there is a configuration
  if (!model) {
    return next(badRequest('Cannot simulate a null model'));
  }
  const { name, devices } = model;
  if (!name || !devices) {
    return next(badRequest('Invalid model'));
  }
  if (!isValidName(name)) {
    return sendBadRequest(res, 'Invalid model name');
  }

  const simId = getObjectId(name);
  // `Simulation` tracks running-ness as `status`, which `start()` sets
  // synchronously; it has no `isRunning`, so the guard this replaces was never
  // true and a topology could be started twice, orphaning the first run.
  if (
    startingSimulations.has(simId) ||
    (allSimulations[simId] && allSimulations[simId].status !== OFFLINE)
  ) {
    // The topology is already in use: the request cannot be applied to the
    // state the resource is in, which is a conflict rather than a fault.
    next(
      conflict(
        'A running simulation is using this topology. A topology can be used only in one running simulation'
      )
    );
  } else {
    const startedTime = Date.now();
    const logFile = `${name}_${Date.now()}.log`;
    const logger = getLogger('SIMULATION', `${logsPath}${logFile}`);
    runLoggers[simId] = logger;
    if (!model.dataStorage && !options.dataStorage) {
      // Use default data storage
      startingSimulations.add(simId);
      getDataStorage((err, ds) => {
        // Released first, so the reservation cannot outlive the start on either
        // path, nor if registering the run throws.
        startingSimulations.delete(simId);
        if (err) {
          next(unavailable('No data storage', err));
        } else {
          const simulation = new Simulation({ ...model, dataStorage: ds }, options, null, logger);
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
      });
    } else {
      const simulation = new Simulation(model, options, null, logger);
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

router.post('/start', validate({ body: simulationStartBody }), function (req, res, next) {
  const { model, modelFileName, options } = req.body;
  if (modelFileName) {
    const modelFilePath = resolveWithin(modelsPath, modelFileName);
    if (!modelFilePath) {
      return sendBadRequest(res, 'Invalid model file name');
    }
    readJSONFile(modelFilePath, (err, myModel) => {
      if (err) {
        next(fileError(err, 'Model not found', 'Cannot read the model file'));
      } else {
        startSimulation(myModel, options, res, next, modelFileName);
      }
    });
  } else {
    startSimulation(model, options, res, next);
  }
});

router.get(
  '/stop/:fileName',
  validate({ params: { fileName: simulationFileNameParam } }),
  function (req, res, next) {
    const { fileName } = req.params;
    const simId = getObjectId(fileName.replace('.json', ''));
    if (allSimulations[simId]) {
      allSimulations[simId].stop();
      allSimulations[simId] = null;
    }
    if (runLoggers[simId]) {
      // The run has stopped: release its log file handle.
      runLoggers[simId].close();
      delete runLoggers[simId];
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
);

router.get('/status', validate(), (req, res, next) => {
  const keys = Object.keys(allSimulationStatus);
  for (let index = 0; index < keys.length; index++) {
    const key = keys[index];
    if (allSimulations[key]) {
      allSimulationStatus[key].isRunning = allSimulations[key].status !== OFFLINE;
    }
  }
  res.send({
    simulationStatus: allSimulationStatus,
  });
});

router.get('/stats', validate(), (req, res, next) => {
  // Read from the registry the rest of this router keeps. It used to read a
  // `simulation` binding that is never assigned, so every call threw a
  // ReferenceError and was answered with a stack trace. With more than one run
  // in progress this reports the first of them, which is as much as the
  // single-valued response shape can say.
  const running = Object.keys(allSimulations)
    .map((simId) => allSimulations[simId])
    .find((simulation) => simulation && simulation.status !== OFFLINE);
  res.send({
    error: null,
    stats: running ? running.getStats() : null,
  });
});

// Attached to the router itself as well as to the application: see the note in
// `routes/model.js`.
router.use(errorHandler);

module.exports = router;
