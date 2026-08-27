'use strict';
/* Working with Data Generator */
var express = require('express');
const Joi = require('joi');
const { OFFLINE } = require('../../core/DeviceStatus');
let getLogger = require('../logger');
const Simulation = require('../../core/simulation');
const { getObjectId } = require('../../core/utils');
const path = require('path');
const { isValidName, resolveWithin, sendBadRequest } = require('./path-safety');
const { getDataStorage } = require('./db-connector');
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
// Log and topology locations come from the central storage-root resolution
// (issue #58): `TAS_MODELS_DIR` still moves the store on its own, and
// `TAS_STORAGE_ROOT` relocates the whole tree.
const { DATA_DIR, LOGS_DIR } = require('../paths');
const logsPath = path.join(LOGS_DIR, 'simulations') + path.sep;
// Stored topologies are records of the artifact store (issue #30) shared with
// the model routes: reads see either a complete previous record or a complete
// new one, never a half-written file. `TAS_MODELS_DIR` moves it (tests use a
// scratch directory); the same override configures `routes/model.js`.
const modelsPath = process.env.TAS_MODELS_DIR || path.join(DATA_DIR, 'models');
const modelsStore = require('../artifact-store').createArtifactStore({
  root: modelsPath,
  label: 'models',
});
// Every running-run record and in-process handle lives in the shared runtime
// registry (issue #29) - nothing is tracked in this module's own variables any
// more. The records are persisted, so they survive a restart and can be seen
// by a second server process on the same store; the handles cannot, and are
// only ever present in the process that started the run.
const runtimeState = require('../runtime-state');

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
/**
 * Reap a run's leftovers once it has stopped: release its log file handle and
 * drop the registry entry, so repeated runs cannot grow the tracking state.
 * Returns the last known record, for the stop response to report.
 */
const reapSimulation = async (simId) => {
  const handle = runtimeState.getHandle('simulations', simId);
  if (handle && handle.logger) {
    // The run has stopped: release its log file handle.
    handle.logger.close();
  }
  return runtimeState.reap('simulations', simId);
};

/**
 * Strip the registry's bookkeeping fields from a record before it reaches a
 * response: clients see the run, not which pid owns it.
 */
const publicRecord = (record) => {
  if (!record) return record;
  const { owner, kind, status, ...rest } = record;
  void owner;
  void kind;
  void status;
  return rest;
};

/**
 * The status surface the dashboard reads: every record in the shared store,
 * keyed by run id. Self-finished runs are reaped on the way (their devices
 * completed without anyone calling `/stop`), so the map only ever describes
 * work that is still running.
 */
const simulationStatusMap = async () => {
  // A run whose owning handle reports offline has finished on its own - its
  // devices completed without anyone calling `/stop`. The predicate closes
  // the run's log file handle BEFORE reconcile drops the handle entry (after
  // which it could not be found again), so a naturally finished run leaks no
  // file descriptor.
  await runtimeState.reconcile('simulations', (record) => {
    const handle = runtimeState.getHandle('simulations', record.id);
    const finished = !handle || !handle.run || handle.run.status === OFFLINE;
    if (finished && handle && handle.logger) {
      handle.logger.close();
    }
    return finished;
  });
  const records = await runtimeState.list('simulations');
  const map = {};
  for (const record of records) {
    map[record.id] = publicRecord(record);
  }
  return map;
};

/**
 * The final snapshot a stopped run leaves behind: the stop response reports
 * `isRunning: false` with the time it stopped, while the registry itself no
 * longer holds the entry.
 */

const startSimulation = async (model, options = {}, res, next, modelFileName = null) => {
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
  //
  // The reservation is claimed BEFORE anything asynchronous runs: two starts
  // arriving together must not both get past the check. The SHARED store is
  // read as well, so another server process on the same store running the
  // topology is a conflict too - the consistent view means neither process
  // will double-start it. (`startingSimulations` used to be a module-level
  // Set; the reservation now lives in the registry.)
  if (
    runtimeState.isReserved('simulations', simId) ||
    (() => {
      const ownHandle = runtimeState.getHandle('simulations', simId);
      return Boolean(ownHandle && ownHandle.run && ownHandle.run.status !== OFFLINE);
    })()
  ) {
    // The topology is already in use: the request cannot be applied to the
    // state the resource is in, which is a conflict rather than a fault.
    return next(
      conflict(
        'A running simulation is using this topology. A topology can be used only in one running simulation'
      )
    );
  }
  runtimeState.reserve('simulations', simId);
  const foreignRecord = await runtimeState
    .list('simulations')
    .then((records) => records.some((record) => record.id === simId))
    .catch(() => false);
  if (foreignRecord) {
    runtimeState.releaseReservation('simulations', simId);
    return next(
      conflict(
        'A running simulation is using this topology. A topology can be used only in one running simulation'
      )
    );
  }
  const startedTime = Date.now();
  const logFile = `${name}_${Date.now()}.log`;
  // The run's own records all carry the run id, so everything one simulation
  // wrote can be pulled out of its file (and the server log) with one filter.
  const logger = getLogger('SIMULATION', `${logsPath}${logFile}`, { correlationId: simId });
  if (!model.dataStorage && !options.dataStorage) {
    // Use default data storage
    getDataStorage(async (err, ds) => {
      // Released first, so the reservation cannot outlive the start on either
      // path, nor if registering the run throws.
      runtimeState.releaseReservation('simulations', simId);
      if (err) {
        next(unavailable('No data storage', err));
      } else {
        const simulation = new Simulation({ ...model, dataStorage: ds }, options, null, logger);
        simulation.start();
        // The start answer follows the persisted record: once it has been
        // sent, any later status read - here or from another process - sees
        // the run.
        await registerStarted(simulation, logger, {
          id: simId,
          model: model.name,
          startedTime,
          logFile,
          datasetId: simulation.datasetId,
          newDataset: simulation.newDataset,
          report: simulation.report,
          modelFileName,
          isRunning: true,
        });

        respondWithStatus(res, { model });
      }
    });
  } else {
    const simulation = new Simulation(model, options, null, logger);
    simulation.start();
    // The start answer follows the persisted record: once it has been sent,
    // any later status read - here or from another process - sees the run.
    await registerStarted(simulation, logger, {
      id: simId,
      model: model.name,
      startedTime,
      logFile,
      datasetId: simulation.datasetId,
      newDataset: simulation.newDataset,
      report: simulation.report,
      modelFileName,
      isRunning: true,
    });
    // The handle table now answers the guard for this topology.
    runtimeState.releaseReservation('simulations', simId);

    respondWithStatus(res, { model });
  }
};

/**
 * Pair a freshly started run with its persisted record: the record goes to the
 * shared store (visible after restarts and to other processes), the live
 * object and its logger stay with this process so `/stop` can reach them.
 */
const registerStarted = (simulation, logger, record) =>
  // Persistence failures degrade to memory-only tracking (warned once inside
  // the registry); they never fail a start that itself succeeded.
  runtimeState.register('simulations', record, { run: simulation, logger }).catch(() => {});

/**
 * Answer with the current status map, whatever the endpoint otherwise returns.
 */
const respondWithStatus = (res, extra = {}) => {
  simulationStatusMap()
    .then((simulationStatus) => {
      res.send({ ...extra, simulationStatus });
    })
    .catch(() => {
      res.send({ ...extra, simulationStatus: {} });
    });
};

router.post('/start', validate({ body: simulationStartBody }), function (req, res, next) {
  const { model, modelFileName, options } = req.body;
  if (modelFileName) {
    // Containment, not validation: the schema has already established that the
    // name is well formed, but the path it derives is still checked at the sink.
    if (!resolveWithin(modelsStore.root, modelFileName)) {
      return sendBadRequest(res, 'Invalid model file name');
    }
    modelsStore
      .read(modelFileName)
      .then((myModel) => {
        startSimulation(myModel, options, res, next, modelFileName).catch(next);
      })
      .catch((err) => next(fileError(err, 'Model not found', 'Cannot read the model file')));
  } else {
    startSimulation(model, options, res, next).catch(next);
  }
});

/**
 * Stop whatever the id refers to, according to who owns it:
 *
 *  - a run this process owns is stopped for real (its handle is called) and
 *    reaped from the registry;
 *  - a record whose owner is gone - work orphaned by an unclean shutdown - is
 *    reaped, which is how a restart cleans up what it can no longer stop;
 *  - a run another live process owns cannot be stopped from here: its record
 *    stays exactly as it is, still reported running;
 *  - an unknown id is answered with the current status, as before.
 *
 * Returns the final snapshot to report (null when nothing here was stopped);
 * the route merges exactly that snapshot into its response, so a run this
 * process did not stop can never be described as stopped.
 */
const stopSimulationById = async (simId) => {
  const endTime = Date.now();
  const handle = runtimeState.getHandle('simulations', simId);
  let records = [];
  try {
    records = await runtimeState.list('simulations');
  } catch (_) {
    records = [];
  }
  const record = records.find((entry) => entry.id === simId) || null;

  if (handle) {
    // This process owns the run: stop it for real and take its entry out of
    // the registry.
    if (handle.run) {
      handle.run.stop();
    }
    const stopped = await reapSimulation(simId);
    return snapshot(stopped || record, endTime);
  }
  if (record && !runtimeState.ownerIsAlive(record)) {
    // Work orphaned by an unclean shutdown: nothing can ever stop it again,
    // so stopping means reaping what it left behind.
    const stopped = await runtimeState.reap('simulations', simId);
    return snapshot(stopped || record, endTime);
  }
  // Someone else's live run, or an id nothing is tracking: visible through
  // the status map at most, never stoppable from this process.
  return null;
};

const snapshot = (record, endTime) => {
  if (!record) return null;
  return publicRecord({ ...record, isRunning: false, endTime });
};

router.get(
  '/stop/:fileName',
  validate({ params: { fileName: simulationFileNameParam } }),
  function (req, res, next) {
    const { fileName } = req.params;
    const simId = getObjectId(fileName.replace('.json', ''));
    stopSimulationById(simId)
      .then((stopped) => simulationStatusMap().then((map) => ({ stopped, map })))
      .then(({ stopped, map }) => {
        res.send({
          error: null,
          // The response still reports the run that was just stopped, with
          // its final state - while the registry itself has dropped it, so
          // the tracking structures cannot grow over repeated runs. Only a
          // stop that actually happened contributes a snapshot.
          simulationStatus: {
            ...map,
            ...(stopped ? { [simId]: stopped } : {}),
          },
        });
      })
      .catch(next);
  }
);

router.get('/status', validate(), (req, res, next) => {
  simulationStatusMap()
    .then((simulationStatus) => {
      res.send({
        simulationStatus,
      });
    })
    .catch(next);
});

router.get('/stats', validate(), (req, res, next) => {
  // Read from the shared registry. It used to read a `simulation` binding that
  // is never assigned, so every call threw a ReferenceError and was answered
  // with a stack trace. With more than one run in progress this reports the
  // first of them, which is as much as the single-valued response shape can
  // say; runs owned by another process have no handle here and report null.
  const running = runtimeState
    .ownHandles('simulations')
    .map(({ handle }) => handle)
    .find((handle) => handle && handle.run && handle.run.status !== OFFLINE);
  res.send({
    error: null,
    stats: running ? running.run.getStats() : null,
  });
});

// Attached to the router itself as well as to the application: see the note in
// `routes/model.js`.
router.use(errorHandler);

module.exports = router;
