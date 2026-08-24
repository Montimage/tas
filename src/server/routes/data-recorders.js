/* Working with Data Generator */
var express = require('express');
const Joi = require('joi');
const DataRecorder = require('../../core/data-recorder');

const { getObjectId } = require('../../core/utils');
const { isValidName, resolveWithin, sendBadRequest } = require('./path-safety');
const {
  validate,
  documentSchema,
  safeNameSchema,
  fileNameParam,
  fileNameMaxLength,
  dataStorageSchema,
  datasetSchema,
} = require('../middleware/validate');
const {
  errorHandler,
  badRequest,
  conflict,
  fileError,
  internal,
  unavailable,
} = require('../middleware/errors');
const { createArtifactStore } = require('../artifact-store');
let router = express.Router();
let getLogger = require('../logger');
const { getDataStorage } = require('./db-connector');
// The stored recorder definitions are records of the artifact store (issue
// #30): writes are serialized under the store's lock and land atomically, so
// concurrent edits queue up instead of discarding one another and a crash
// mid-write cannot leave a truncated file behind. Existing loose files in the
// directory are adopted as they are - there is no migration step.
// `TAS_DATA_RECORDERS_DIR` moves the store (tests use a scratch directory).
const dataRecordersPath =
  process.env.TAS_DATA_RECORDERS_DIR || `${__dirname}/../data/data-recorders/`;
const recordersStore = createArtifactStore({
  root: dataRecordersPath,
  label: 'data-recorders',
});
let logsPath = `${__dirname}/../logs/data-recorders/`;
// Running-recorder records and handles live in the shared runtime registry
// (issue #29): records persist across restarts and are visible to a second
// server process on the same store, handles stay with the owning process.
const runtimeState = require('../runtime-state');

// ---------------------------------------------------------------------------
// Validation schemas for the data-recorder endpoints (issue #10)
// ---------------------------------------------------------------------------

const recorderNameParam = fileNameParam('.json');

const dataRecorderBody = documentSchema({
  name: safeNameSchema.required(),
  dataRecorders: Joi.array().items(Joi.object()).required(),
  // `DataRecorder` reads both of these straight off the document it is handed:
  // `dataStorage` becomes the database every recorded event is written to, and
  // `dataset` is the document `saveDataset` looks up by `id`. A recorder
  // carries plenty of other fields, so unknown keys still pass — but not these
  // two, which `.unknown(true)` would otherwise admit with any shape at all.
  dataStorage: dataStorageSchema.allow(null),
  dataset: datasetSchema.allow(null),
});

const dataRecorderCreateBody = Joi.object({
  dataRecorder: dataRecorderBody.required(),
}).required();

// As with models, the update route doubles as the duplicate route: exactly one
// of the document and the flag arrives.
const dataRecorderUpdateBody = Joi.object({
  dataRecorder: dataRecorderBody,
  isDuplicated: Joi.valid(true),
})
  .xor('dataRecorder', 'isDuplicated')
  .required();

// A run is started either from a stored file or from an inline document, never
// from neither.
const dataRecorderStartBody = Joi.object({
  model: dataRecorderBody,
  dataRecorderFileName: Joi.string().max(fileNameMaxLength('.json')),
})
  .or('model', 'dataRecorderFileName')
  .required();

///////////////
// DATA RECORDERS
///////////////

/**
 * The status shape each entry reports:
 * {
 *    isRunning: true|false,
 *    model: {},
 *    startedTime: timestamp,
 *    stoppedTime: timestamp,
 *    logFile: String
 * }
 *
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
 * keyed by recorder id. Records whose owner is gone - work orphaned by an
 * unclean shutdown - are reaped on the way, so the map only ever describes
 * work that is still running somewhere live.
 */
const recorderStatusMap = async () => {
  await runtimeState.reconcile('data-recorders');
  const records = await runtimeState.list('data-recorders');
  const map = {};
  for (const record of records) {
    map[record.id] = publicRecord(record);
  }
  return map;
};

/**
 * Release a stopped recorder's log file handle and drop its registry entry.
 */
const reapRecorder = async (recorderId) => {
  const handle = runtimeState.getHandle('data-recorders', recorderId);
  if (handle && handle.logger) {
    // The run has stopped: release its log file handle.
    handle.logger.close();
  }
  return runtimeState.reap('data-recorders', recorderId);
};

/**
 * Get the running status of data recorder
 */
router.get('/status', validate(), (req, res, next) => {
  recorderStatusMap()
    .then((status) => {
      res.send({ status });
    })
    .catch(next);
});

// Stop the running data recorder
router.get(
  '/stop/:fileName',
  validate({ params: { fileName: recorderNameParam } }),
  function (req, res, next) {
    const { fileName } = req.params;
    const recorderId = getObjectId(fileName.replace('.json', ''));
    stopRecorderById(recorderId)
      .then((stopped) => recorderStatusMap().then((map) => ({ stopped, map })))
      .then(({ stopped, map }) => {
        res.send({
          error: null,
          // The response still reports the recorder that was just stopped,
          // with its final state - while the registry itself has dropped it,
          // so the tracking structures cannot grow over repeated runs. Only
          // a stop that actually happened contributes a snapshot.
          status: {
            ...map,
            ...(stopped ? { [recorderId]: stopped } : {}),
          },
        });
      })
      .catch(next);
  }
);

const snapshotRecorder = (record, endTime) => {
  if (!record) return null;
  return publicRecord({ ...record, isRunning: false, endTime });
};

/**
 * Stop whatever the id refers to, according to who owns it - mirroring the
 * simulation router: own runs are stopped and reaped, orphans left by an
 * unclean shutdown are reaped, another live process's recorder is visible but
 * not stoppable from here, and an unknown id answers with the current status.
 */
const stopRecorderById = async (recorderId) => {
  const endTime = Date.now();
  const handle = runtimeState.getHandle('data-recorders', recorderId);
  let records = [];
  try {
    records = await runtimeState.list('data-recorders');
  } catch (_) {
    records = [];
  }
  const record = records.find((entry) => entry.id === recorderId) || null;

  if (handle) {
    // This process owns the recorder: stop it for real.
    if (handle.run) {
      handle.run.stop();
    }
    const stopped = await reapRecorder(recorderId);
    return snapshotRecorder(stopped || record, endTime);
  }
  if (record && !runtimeState.ownerIsAlive(record)) {
    const stopped = await runtimeState.reap('data-recorders', recorderId);
    return snapshotRecorder(stopped || record, endTime);
  }
  return null;
};

const startRecorder = async (model, res, next) => {
  if (!model) {
    return next(badRequest('Cannot find data recorder configuration'));
  }
  const { name, dataRecorders, dataStorage } = model;
  if (!name || !dataRecorders) {
    return next(badRequest('Invalid data recorder model'));
  }
  if (!isValidName(name)) {
    return next(badRequest('Invalid data recorder name'));
  }
  const recorderId = getObjectId(name);
  // The reservation is claimed BEFORE anything asynchronous runs, so two
  // starts arriving together cannot both get past the check. The SHARED store
  // is read as well: a recorder another process on the same store runs is a
  // conflict too.
  if (
    runtimeState.isReserved('data-recorders', recorderId) ||
    runtimeState.getHandle('data-recorders', recorderId)
  ) {
    // The recorder is already running: the request cannot be applied to the
    // state the resource is in, which is a conflict rather than a fault.
    return next(conflict('Recorder has already started'));
  }
  runtimeState.reserve('data-recorders', recorderId);
  const foreignRecord = await runtimeState
    .list('data-recorders')
    .then((records) => records.some((record) => record.id === recorderId))
    .catch(() => false);
  if (foreignRecord) {
    runtimeState.releaseReservation('data-recorders', recorderId);
    return next(conflict('Recorder has already started'));
  }
  const startedTime = Date.now();
  const logFile = `${name}_${startedTime}.log`;
  const logger = getLogger('DATA-RECORDER', `${logsPath}${logFile}`);
  // Persistence failures degrade to memory-only tracking (warned once inside
  // the registry); they never fail a start that itself succeeded.
  const registerStarted = (recorder, record) =>
    runtimeState.register('data-recorders', record, { run: recorder, logger }).catch(() => {});
  if (!dataStorage) {
    // use default data storage
    getDataStorage(async (err, ds) => {
      // Released first, so the reservation cannot outlive the start on
      // either path, nor if registering the recorder throws.
      runtimeState.releaseReservation('data-recorders', recorderId);
      if (err) {
        next(unavailable('No data storage', err));
      } else {
        const dataRecorder = new DataRecorder(
          {
            ...model,
            dataStorage: ds,
          },
          logger
        );
        dataRecorder.start();
        logger.log('[data-recorders] A data recorder has been started ...');
        // The start answer follows the persisted record: once it has been
        // sent, any later status read - here or from another process - sees
        // the recorder.
        await registerStarted(dataRecorder, {
          id: recorderId,
          isRunning: true,
          model: name,
          startedTime,
          endTime: null,
          logFile,
        });
        respondWithStatus(res, { model });
      }
    });
  } else {
    const dataRecorder = new DataRecorder(model, logger);
    dataRecorder.start();
    logger.log('[data-recorders] A data recorder has been started ...');
    // The start answer follows the persisted record.
    await registerStarted(dataRecorder, {
      id: recorderId,
      isRunning: true,
      model: name,
      startedTime,
      endTime: null,
      logFile,
    });
    // The handle table now answers the guard for this recorder.
    runtimeState.releaseReservation('data-recorders', recorderId);
    respondWithStatus(res, { model });
  }
};

/**
 * Answer with the current status map, whatever the endpoint otherwise returns.
 */
const respondWithStatus = (res, extra = {}) => {
  recorderStatusMap()
    .then((status) => {
      res.send({ ...extra, status });
    })
    .catch(() => {
      res.send({ ...extra, status: {} });
    });
};

// Start a data recorder
router.post('/start', validate({ body: dataRecorderStartBody }), (req, res, next) => {
  const { model, dataRecorderFileName } = req.body;
  if (dataRecorderFileName) {
    // start recorder by file name
    // Containment, not validation: the schema has already established that the
    // name is well formed, but the path it derives is still checked at the sink.
    if (!resolveWithin(recordersStore.root, dataRecorderFileName)) {
      return sendBadRequest(res, 'Invalid data recorder file name');
    }
    recordersStore
      .read(dataRecorderFileName)
      .then((data) => {
        startRecorder(data, res, next).catch(next);
      })
      .catch((err) =>
        next(fileError(err, 'Data recorder not found', 'Cannot read the data recorder file'))
      );
  } else {
    // Start recorder by model
    startRecorder(model, res, next).catch(next);
  }
});

// Read the list of data recorders
router.get('/models/', validate(), (req, res, next) => {
  recordersStore
    .list()
    .then((dataRecorders) => {
      res.send({
        error: null,
        dataRecorders,
      });
    })
    .catch((err) => next(internal('Cannot read the data recorders directory', err)));
});

// Read a specific data recorder by its name:
router.get(
  '/models/:fileName',
  validate({ params: { fileName: recorderNameParam } }),
  function (req, res, next) {
    const { fileName } = req.params;
    if (!resolveWithin(recordersStore.root, fileName)) {
      return sendBadRequest(res, 'Invalid data recorder name');
    }
    recordersStore
      .read(fileName)
      .then((data) => {
        res.send({
          error: null,
          dataRecorder: data,
        });
      })
      .catch((err) =>
        next(fileError(err, 'Data recorder not found', 'Cannot read the data recorder file'))
      );
  }
);

/** Map a store write failure onto its HTTP answer; a taken name is a conflict. */
const saveError = (message, next) => (err) => {
  if (err && err.code === 'EARTIFACTCONFLICT') {
    return next(conflict('A data recorder with this name already exists'));
  }
  return next(internal(message, err));
};

const updateDataRecorder = (fileName, dataRecorder, res, next) => {
  const { name } = dataRecorder;
  // Containment, not validation: the schema has already established that the
  // name is well formed, but the path it derives is still checked at the sink.
  if (!isValidName(name)) {
    return sendBadRequest(res, 'Invalid data recorder name');
  }
  const newName = `${name}.json`;
  if (
    !resolveWithin(recordersStore.root, fileName) ||
    !resolveWithin(recordersStore.root, newName)
  ) {
    return sendBadRequest(res, 'Invalid data recorder name');
  }
  const sameName = (message) => (err) => {
    if (err && err.code === 'EARTIFACTCONFLICT') {
      return next(conflict('A data recorder with this name already exists'));
    }
    return next(internal(message, err));
  };
  if (newName === fileName) {
    recordersStore
      .write(newName, dataRecorder, { overwrite: true })
      .then(() => {
        res.send({
          dataRecorderFileName: fileName,
        });
      })
      .catch(sameName('Cannot save the new configuration'));
  } else {
    // Rename inside the store: the copy under the new name lands atomically
    // and the old one is removed within the same locked step.
    recordersStore
      .rename(fileName, newName)
      .then(() => {
        res.send({
          dataRecorderFileName: fileName,
        });
      })
      .catch((err) => {
        if (err && err.code === 'EARTIFACTCONFLICT') {
          return next(conflict('A data recorder with this name already exists'));
        }
        if (err && (err.code === 'ENOENT' || err.code === 'ENOTDIR')) {
          return next(
            fileError(err, 'Data recorder not found', 'Cannot read the data recorder file')
          );
        }
        return next(internal('Cannot save the new configuration', err));
      });
  }
};

const duplicateDataRecorder = (fileName, res, next) => {
  if (!resolveWithin(recordersStore.root, fileName)) {
    return sendBadRequest(res, 'Invalid data recorder name');
  }
  recordersStore
    .withExclusive(async (unlocked) => {
      const data = await unlocked.read(fileName);
      const newName = `${data.name} [Duplicated]`;
      if (!isValidName(newName)) {
        const err = new Error('Invalid data recorder name');
        err.code = 'EARTIFACTPATH';
        throw err;
      }
      const newFileName = `${newName}.json`;
      await unlocked.writeRaw(newFileName, { ...data, name: newName });
      return { newFileName };
    })
    .then(({ newFileName }) => {
      res.send({
        dataRecorderFileName: newFileName,
      });
    })
    .catch((err) => {
      if (err.code === 'EARTIFACTPATH') {
        return sendBadRequest(res, 'Invalid data recorder name');
      }
      if (err.code === 'ENOENT' || err.code === 'ENOTDIR') {
        return next(
          fileError(err, 'Data recorder not found', 'Cannot read the data recorder file')
        );
      }
      return saveError('Cannot save the duplicated data recorder', next)(err);
    });
};

// Update a data recorder
router.post(
  '/models/:fileName',
  validate({ params: { fileName: recorderNameParam }, body: dataRecorderUpdateBody }),
  function (req, res, next) {
    const { fileName } = req.params;

    const { dataRecorder, isDuplicated } = req.body;
    if (isDuplicated) {
      duplicateDataRecorder(fileName, res, next);
    } else {
      updateDataRecorder(fileName, dataRecorder, res, next);
    }
  }
);

// Save a new dataRecorder
router.post('/models', validate({ body: dataRecorderCreateBody }), function (req, res, next) {
  const { dataRecorder } = req.body;
  const { name } = dataRecorder;
  // Containment, not validation: the schema has already established that the
  // name is well formed, but the path it derives is still checked at the sink.
  if (!isValidName(name)) {
    return sendBadRequest(res, 'Invalid data recorder name');
  }
  const dataRecorderFileName = `${dataRecorder.name}.json`;
  if (!resolveWithin(recordersStore.root, dataRecorderFileName)) {
    return sendBadRequest(res, 'Invalid data recorder name');
  }
  // The store refuses to replace an existing record, so saving over a taken
  // name is answered with a conflict instead of a silently renamed copy.
  recordersStore
    .write(dataRecorderFileName, dataRecorder)
    .then(() => {
      res.send({
        error: null,
        dataRecorderFileName,
      });
    })
    .catch(saveError('Cannot save the new configuration', next));
});

// Delete a data recorder
router.delete(
  '/models/:fileName',
  validate({ params: { fileName: recorderNameParam } }),
  function (req, res, next) {
    const { fileName } = req.params;
    if (!resolveWithin(recordersStore.root, fileName)) {
      return sendBadRequest(res, 'Invalid data recorder name');
    }
    recordersStore
      .remove(fileName)
      .then(() => {
        res.send({
          error: null,
          result: true,
        });
      })
      .catch((err) =>
        next(fileError(err, 'Data recorder not found', 'Cannot delete the data recorder file'))
      );
  }
);

// Attached to the router itself as well as to the application: see the note in
// `routes/model.js`.
router.use(errorHandler);

module.exports = router;
