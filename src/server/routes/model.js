'use strict';
/* Working with Data Generator */
var express = require('express');
const path = require('path');
const Joi = require('joi');

const { createArtifactStore } = require('../artifact-store');
const { isValidName, resolveWithin, sendBadRequest } = require('./path-safety');
const {
  validate,
  documentSchema,
  safeNameSchema,
  fileNameParam,
  simulationRunFields,
} = require('../middleware/validate');
const { errorHandler, fileError, internal, conflict } = require('../middleware/errors');
const { DATA_DIR } = require('../paths');

// The topologies live as records of the artifact store (issue #30): writes are
// serialized under the store's lock and land atomically, so concurrent edits
// queue up instead of discarding one another and a crash mid-write cannot leave
// a truncated file behind. Existing loose files in the directory are adopted
// as they are - there is no migration step. `TAS_MODELS_DIR` moves the store
// (tests use this to work against a scratch directory); `TAS_STORAGE_ROOT`
// relocates the whole tree (issue #58).
const modelsPath = process.env.TAS_MODELS_DIR || path.join(DATA_DIR, 'models');
const modelsStore = createArtifactStore({ root: modelsPath, label: 'models' });
let router = express.Router();

/**
 * Translate an artifact-store failure into its HTTP answer: a taken name is a
 * conflict, anything else is ours. Missing records never reach here - the
 * store throws them with a native ENOENT code, which `fileError` maps to 404.
 */
const saveError = (next, err) => {
  if (err && err.code === 'EARTIFACTCONFLICT') {
    return next(conflict('A model with this name already exists'));
  }
  return next(internal('Cannot save the new configuration', err));
};

/**
 * The rename variant of `saveError`: renaming needs the source record to
 * exist, so its absence is answered as the missing resource it is.
 */
const renameError = (next, err) => {
  if (err && (err.code === 'ENOENT' || err.code === 'ENOTDIR')) {
    return next(fileError(err, 'Model not found', 'Cannot read the model file'));
  }
  return saveError(next, err);
};

// ---------------------------------------------------------------------------
// Validation schemas for the model endpoints (issue #10)
// ---------------------------------------------------------------------------

const modelNameParam = fileNameParam('.json');

const modelBody = documentSchema({
  name: safeNameSchema.required(),
  devices: Joi.array().items(Joi.object()).required(),
  // A stored topology is started later by file name, and `POST
  // /api/simulation/start` reads it off disk without revalidating it, so the
  // run-configuration fields reach `Simulation` exactly as they were written
  // here. Constraining them only on the start route would leave storing them
  // as the way around it. Every other field a topology carries still passes.
  ...simulationRunFields,
});

// A model is created with its full document.
const modelCreateBody = Joi.object({
  model: modelBody.required(),
}).required();

// The same endpoint updates a model and duplicates one. A duplicate request
// carries only the flag and an update carries only the model, so declaring
// exactly one of the two is what lets the handler branch without re-checking
// that the model it is about to write actually arrived.
const modelUpdateBody = Joi.object({
  model: modelBody,
  isDuplicated: Joi.valid(true),
})
  .xor('model', 'isDuplicated')
  .required();

///////////////
// MODEL
///////////////

// Read the list of models
router.get('/', validate(), (req, res, next) => {
  modelsStore
    .list()
    .then((models) => {
      res.send({
        error: null,
        models,
      });
    })
    .catch((err) => next(internal('Cannot read the models directory', err)));
});

// Read a specific model by its name:
router.get(
  '/:fileName',
  validate({ params: { fileName: modelNameParam } }),
  function (req, res, next) {
    const { fileName } = req.params;
    // Containment, not validation: the schema has already established that the
    // name is well formed, but the path it derives is still checked at the sink.
    if (!resolveWithin(modelsStore.root, fileName)) {
      return sendBadRequest(res, 'Invalid model name');
    }
    modelsStore
      .read(fileName)
      .then((data) => {
        res.send({
          error: null,
          model: data,
        });
      })
      .catch((err) => next(fileError(err, 'Model not found', 'Cannot read the model file')));
  }
);

// Bound the search for a free "[Duplicated]" name so a pathological
// directory cannot spin the event loop (issue #70).
const MAX_DUPLICATE_CANDIDATES = 1000;

/**
 * Derive the first available "<name> [Duplicated]" filename for a duplicate.
 * Every candidate is re-checked against the name allowlist, because the
 * suffix grows the name and the length cap may cut the search short.
 *
 * The search runs inside the caller's exclusive section, so no other mutation
 * of the store can claim the found name between the probe and the write.
 * @param {String} sourceName The stored model name being duplicated
 * @param {Object} unlocked The artifact store's unlocked primitives
 * @returns {Promise<{name: String, fileName: String}|null>} A free candidate, or null
 */
const findFreeDuplicate = async (sourceName, unlocked) => {
  for (let i = 1; i <= MAX_DUPLICATE_CANDIDATES; i++) {
    const candidate = i === 1 ? `${sourceName} [Duplicated]` : `${sourceName} [Duplicated] ${i}`;
    if (!isValidName(candidate)) continue;
    const candidateFileName = `${candidate}.json`;
    if (resolveWithin(modelsStore.root, candidateFileName)) {
      try {
        if (!(await unlocked.exists(candidateFileName))) {
          return { name: candidate, fileName: candidateFileName };
        }
      } catch (_) {
        // An unreadable directory answers "not free" and the search moves on.
      }
    }
  }
  return null;
};

const duplicateModel = (fileName, res, next) => {
  // Containment first: the rest of this handler works on names derived from it.
  if (!resolveWithin(modelsStore.root, fileName)) {
    return sendBadRequest(res, 'Invalid model name');
  }
  modelsStore
    .withExclusive(async (unlocked) => {
      const source = await unlocked.read(fileName);
      // Collision policy (issue #70): duplicating must never overwrite an
      // earlier copy, so write to a name proven free inside this exclusive
      // section and report exactly it.
      const free = await findFreeDuplicate(source.name, unlocked);
      if (!free) {
        return { conflict: true };
      }
      await unlocked.writeRaw(`${free.name}.json`, { ...source, name: free.name });
      return { modelFileName: `${free.name}.json` };
    })
    .then((outcome) => {
      if (outcome.conflict) {
        return next(conflict('Cannot derive a free name for the duplicated model'));
      }
      res.send({ modelFileName: outcome.modelFileName });
    })
    .catch((err) => {
      if (err.code === 'EARTIFACTPATH') {
        return sendBadRequest(res, 'Invalid model name');
      }
      if (err.code === 'ENOENT' || err.code === 'ENOTDIR') {
        return next(fileError(err, 'Model not found', 'Cannot read the model file'));
      }
      return next(internal('Cannot save the duplicated model', err));
    });
};

const updateModel = (model, fileName, res, next) => {
  const { name } = model;
  // Containment, not validation: the schema has already established that the
  // name is well formed, but the path it derives is still checked at the sink.
  if (!isValidName(name)) {
    return sendBadRequest(res, 'Invalid model name');
  }
  const newName = `${name}.json`;
  if (!resolveWithin(modelsStore.root, fileName) || !resolveWithin(modelsStore.root, newName)) {
    return sendBadRequest(res, 'Invalid model name');
  }
  if (fileName === newName) {
    modelsStore
      .write(newName, model, { overwrite: true })
      .then(() => {
        res.send({
          modelFileName: fileName,
        });
      })
      .catch((err) => saveError(next, err));
  } else {
    // Rename inside the store: the copy under the new name lands atomically
    // and the old one is removed within the same locked step, so a crash or a
    // concurrent reader can never see both copies or neither.
    modelsStore
      .rename(fileName, newName)
      .then(() => {
        res.send({
          modelFileName: newName,
        });
      })
      .catch((err) =>
        err && err.code === 'EARTIFACTCONFLICT'
          ? next(conflict('A model with this name already exists'))
          : renameError(next, err)
      );
  }
};

// Update a model - or duplicate a model
router.post(
  '/:fileName',
  validate({ params: { fileName: modelNameParam }, body: modelUpdateBody }),
  function (req, res, next) {
    const { fileName } = req.params;

    const { model, isDuplicated } = req.body;
    if (isDuplicated) {
      // Duplicate the model
      duplicateModel(fileName, res, next);
    } else {
      // Update model
      updateModel(model, fileName, res, next);
    }
  }
);

// Save a new model
router.post('/', validate({ body: modelCreateBody }), function (req, res, next) {
  const { model } = req.body;
  const { name } = model;
  // Containment, not validation: see `updateModel` above.
  if (!isValidName(name)) {
    return sendBadRequest(res, 'Invalid model name');
  }

  const modelFileName = `${model.name}.json`;
  if (!resolveWithin(modelsStore.root, modelFileName)) {
    return sendBadRequest(res, 'Invalid model name');
  }
  // Collision policy (issue #70), enforced by the store itself: the write
  // refuses to replace an existing record, so duplicating a name is answered
  // with a conflict and the filename this handler returns is always the exact
  // record that was written.
  modelsStore
    .write(modelFileName, model)
    .then(() => {
      res.send({
        modelFileName,
      });
    })
    .catch((err) => saveError(next, err));
});

// Delete a model
router.delete(
  '/:fileName',
  validate({ params: { fileName: modelNameParam } }),
  function (req, res, next) {
    const { fileName } = req.params;
    if (!resolveWithin(modelsStore.root, fileName)) {
      return sendBadRequest(res, 'Invalid model name');
    }
    modelsStore
      .remove(fileName)
      .then(() => {
        res.send({
          result: true,
        });
      })
      .catch((err) => next(fileError(err, 'Model not found', 'Cannot delete the model file')));
  }
);

// The shared handler is attached to the router itself, not only to the
// application: a router mounted on its own would otherwise fall through to
// Express's default error handler, which answers with an HTML stack trace.
router.use(errorHandler);

module.exports = router;
