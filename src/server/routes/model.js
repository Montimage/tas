/* Working with Data Generator */
var express = require('express');
var path = require('path');
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
const { errorHandler, fileError, internal } = require('../middleware/errors');
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

const duplicateModel = (fileName, res, next) => {
  const modelFile = resolveWithin(modelsPath, fileName);
  if (!modelFile) {
    return sendBadRequest(res, 'Invalid model name');
  }
  readJSONFile(modelFile, (err, data) => {
    if (err) {
      next(fileError(err, 'Model not found', 'Cannot read the model file'));
    } else {
      const newName = `${data.name} [Duplicated]`;
      const newModel = { ...data, name: newName };
      if (!isValidName(newName)) {
        return sendBadRequest(res, 'Invalid model name');
      }
      const newFileName = `${newName}.json`;
      const newFile = resolveWithin(modelsPath, newFileName);
      if (!newFile) {
        return sendBadRequest(res, 'Invalid model name');
      }
      writeToFile(
        newFile,
        JSON.stringify(newModel),
        (err, dupModel) => {
          if (err) {
            next(internal('Cannot save the duplicated model', err));
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
  writeToFile(modelFilePath, JSON.stringify(model), (err, data) => {
    if (err) {
      next(internal('Cannot save the new configuration', err));
    } else {
      res.send({
        modelFileName,
      });
    }
  });
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
