/* Working with Data Generator */
var express = require('express');
var path = require('path');
var fs = require('fs');
const Joi = require('joi');

const { readJSONFile, writeToFile, readDir, deleteFile } = require('../../core/utils');
const { isValidName, resolveWithin, sendBadRequest } = require('./path-safety');
const {
  validate,
  documentSchema,
  safeNameSchema,
  fileNameParam,
  simulationRunFields,
} = require('../middleware/validate');
const { errorHandler, fileError, internal, conflict } = require('../middleware/errors');
const modelsPath = `${__dirname}/../data/models/`;
let router = express.Router();

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
  readDir(modelsPath, (err, files) => {
    if (err) {
      next(internal('Cannot read the models directory', err));
    } else {
      res.send({
        error: null,
        models: files.filter((f) => path.extname(f) === '.json'),
      });
    }
  });
});

// Read a specific model by its name:
router.get(
  '/:fileName',
  validate({ params: { fileName: modelNameParam } }),
  function (req, res, next) {
    const { fileName } = req.params;
    const modelFile = resolveWithin(modelsPath, fileName);
    if (!modelFile) {
      return sendBadRequest(res, 'Invalid model name');
    }
    readJSONFile(modelFile, (err, data) => {
      if (err) {
        next(fileError(err, 'Model not found', 'Cannot read the model file'));
      } else {
        res.send({
          error: null,
          model: data,
        });
      }
    });
  }
);

// Bound the search for a free "[Duplicated]" name so a pathological
// directory cannot spin the event loop (issue #70).
const MAX_DUPLICATE_CANDIDATES = 1000;

/**
 * Derive the first available "<name> [Duplicated]" filename for a duplicate.
 * Every candidate is re-checked against the name allowlist, because the
 * suffix grows the name and the length cap may cut the search short.
 * @param {String} sourceName The stored model name being duplicated
 * @returns {{name: String, path: String}|null} A free candidate, or null
 */
const findFreeDuplicate = (sourceName) => {
  for (let i = 1; i <= MAX_DUPLICATE_CANDIDATES; i++) {
    const candidate = i === 1 ? `${sourceName} [Duplicated]` : `${sourceName} [Duplicated] ${i}`;
    if (!isValidName(candidate)) continue;
    const candidatePath = resolveWithin(modelsPath, `${candidate}.json`);
    if (candidatePath && !fs.existsSync(candidatePath)) {
      return { name: candidate, path: candidatePath };
    }
  }
  return null;
};

const duplicateModel = (fileName, res, next) => {
  const modelFile = resolveWithin(modelsPath, fileName);
  if (!modelFile) {
    return sendBadRequest(res, 'Invalid model name');
  }
  readJSONFile(modelFile, (err, data) => {
    if (err) {
      next(fileError(err, 'Model not found', 'Cannot read the model file'));
    } else {
      // Collision policy (issue #70): duplicating must never overwrite an
      // earlier copy, so write to a name proven free and report exactly it.
      const free = findFreeDuplicate(data.name);
      if (!free) {
        return next(conflict('Cannot derive a free name for the duplicated model'));
      }
      const newModel = { ...data, name: free.name };
      const newFileName = `${free.name}.json`;
      writeToFile(
        free.path,
        JSON.stringify(newModel),
        (err2) => {
          if (err2) {
            next(internal('Cannot save the duplicated model', err2));
          } else {
            res.send({
              modelFileName: newFileName,
            });
          }
        },
        true
      );
    }
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
  const oldModelFile = resolveWithin(modelsPath, fileName);
  if (!oldModelFile) {
    return sendBadRequest(res, 'Invalid model name');
  }
  const modelFile = resolveWithin(modelsPath, newName);
  if (!modelFile) {
    return sendBadRequest(res, 'Invalid model name');
  }
  if (fileName === newName) {
    writeToFile(
      modelFile,
      JSON.stringify(model),
      (err, data) => {
        if (err) {
          next(internal('Cannot save the new configuration', err));
        } else {
          res.send({
            modelFileName: fileName,
          });
        }
      },
      true
    );
  } else {
    writeToFile(
      modelFile,
      JSON.stringify(model),
      (err, data) => {
        if (err) {
          next(internal('Cannot save the new configuration', err));
        } else {
          // Delete the old model
          deleteFile(oldModelFile, (err2) => {
            if (err2) {
              // The new file is already written, so the rename succeeded from the
              // caller's point of view; the leftover is a server-side problem.
              console.error(
                `[SERVER] Cannot remove the renamed model file | ${err2.stack || err2}`
              );
            }
            res.send({
              modelFileName: newName,
            });
          });
        }
      },
      true
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
  const modelFilePath = resolveWithin(modelsPath, modelFileName);
  if (!modelFilePath) {
    return sendBadRequest(res, 'Invalid model name');
  }
  // Collision policy (issue #70): refuse a duplicate name instead of letting
  // writeToFile silently rename the target — the filename this handler returns
  // must always be the exact file that was written.
  if (fs.existsSync(modelFilePath)) {
    return next(conflict('A model with this name already exists'));
  }
  writeToFile(
    modelFilePath,
    JSON.stringify(model),
    (err, data) => {
      if (err) {
        next(internal('Cannot save the new configuration', err));
      } else {
        res.send({
          modelFileName,
        });
      }
    },
    true
  );
});

// Delete a model
router.delete(
  '/:fileName',
  validate({ params: { fileName: modelNameParam } }),
  function (req, res, next) {
    const { fileName } = req.params;
    const modelFile = resolveWithin(modelsPath, fileName);
    if (!modelFile) {
      return sendBadRequest(res, 'Invalid model name');
    }
    deleteFile(modelFile, (err) => {
      if (err) {
        next(fileError(err, 'Model not found', 'Cannot delete the model file'));
      } else {
        res.send({
          result: true,
        });
      }
    });
  }
);

// The shared handler is attached to the router itself, not only to the
// application: a router mounted on its own would otherwise fall through to
// Express's default error handler, which answers with an HTML stack trace.
router.use(errorHandler);

module.exports = router;
