/* Working with Data Generator */
var express = require("express");
var path = require("path");
const Joi = require("joi");
const DataRecorder = require("../../core/data-recorder");

const {
  readJSONFile,
  writeToFile,
  readDir,
  deleteFile,
  getObjectId,
} = require("../../core/utils");
const {
  isValidName,
  resolveWithin,
  sendBadRequest,
} = require("./path-safety");
const {
  validate,
  documentSchema,
  safeNameSchema,
  fileNameParam,
  fileNameMaxLength,
  dataStorageSchema,
  datasetSchema,
} = require("../middleware/validate");
const {
  errorHandler,
  badRequest,
  conflict,
  fileError,
  internal,
  unavailable,
} = require("../middleware/errors");
const dataRecordersPath = `${__dirname}/../data/data-recorders/`;
let router = express.Router();
let getLogger = require("../logger");
const { getDataStorage } = require("./db-connector");
let logsPath = `${__dirname}/../logs/data-recorders/`;

// ---------------------------------------------------------------------------
// Validation schemas for the data-recorder endpoints (issue #10)
// ---------------------------------------------------------------------------

const recorderNameParam = fileNameParam(".json");

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
  .xor("dataRecorder", "isDuplicated")
  .required();

// A run is started either from a stored file or from an inline document, never
// from neither.
const dataRecorderStartBody = Joi.object({
  model: dataRecorderBody,
  dataRecorderFileName: Joi.string().max(fileNameMaxLength(".json")),
})
  .or("model", "dataRecorderFileName")
  .required();

///////////////
// DATA RECORDERS
///////////////

/**
 * status
 * {
 *    isRunning: true|false,
 *    model: {},
 *    startedTime: timestamp,
 *    stoppedTime: timestamp,
 *    logFile: String
 * }
 */
let allRunningStatus = {};
let allDataRecorders = {};
// The ids whose start is under way. On the default data storage path the
// recorder is only registered inside the `getDataStorage` callback, an
// event-loop turn after the guard below read the registry, so without something
// held across that turn two concurrent starts of one recorder both pass the
// guard and the first one is left recording with no handle to stop it. A
// reservation rather than a placeholder in `allDataRecorders`: `/stop` calls
// `stop()` on whatever it finds there.
const startingDataRecorders = new Set();

/**
 * Get the running status of data recorder
 */
router.get("/status", validate(), (req, res, next) => {
  res.send({
    status: allRunningStatus,
  });
});

// Stop the running data recorder
router.get("/stop/:fileName", validate({ params: { fileName: recorderNameParam } }), function (req, res, next) {
  const { fileName } = req.params;
  const recorderId = getObjectId(fileName.replace('.json',''));
  if (allDataRecorders[recorderId]) {
    allDataRecorders[recorderId].stop();
    allDataRecorders[recorderId] = null;
  }
  if (allRunningStatus[recorderId]) {
    allRunningStatus[recorderId].isRunning = false;
    allRunningStatus[recorderId].endTime = Date.now();
  }
  res.send({
    error: null,
    status: allRunningStatus,
  });
});

const startRecorder = (model, res, next) => {
  if (!model) {
    next(badRequest("Cannot find data recorder configuration"));
  } else {
    const { name, dataRecorders, dataStorage } = model;
    if (!name || !dataRecorders) {
      next(badRequest("Invalid data recorder model"));
    } else if (!isValidName(name)) {
      next(badRequest("Invalid data recorder name"));
    } else {
      const recorderId = getObjectId(name);
      if (startingDataRecorders.has(recorderId) || allDataRecorders[recorderId]) {
        // The recorder is already running: the request cannot be applied to the
        // state the resource is in, which is a conflict rather than a fault.
        next(conflict("Recorder has already started"));
      } else {
        const startedTime = Date.now();
        const logFile = `${name}_${startedTime}.log`;
        getLogger("DATA-RECORDER", `${logsPath}${logFile}`);
        if (!dataStorage) {
          // use default data storage
          startingDataRecorders.add(recorderId);
          getDataStorage((err, ds) => {
            // Released first, so the reservation cannot outlive the start on
            // either path, nor if registering the recorder throws.
            startingDataRecorders.delete(recorderId);
            if (err) {
              next(unavailable("No data storage", err));
            } else {
              const dataRecorder = new DataRecorder({
                ...model,
                dataStorage: ds,
              });
              dataRecorder.start();
              console.log(
                "[data-recorders] A data recorder has been started ..."
              );
              allDataRecorders[`${recorderId}`] = dataRecorder;
              allRunningStatus[`${recorderId}`] = {
                isRunning: true,
                model: name,
                startedTime,
                endTime: null,
                logFile,
              };
              res.send({
                model,
                status: allRunningStatus,
              });
            }
          });
        } else {
          const dataRecorder = new DataRecorder(model);
          dataRecorder.start();
          console.log("[data-recorders] A data recorder has been started ...");
          allDataRecorders[`${recorderId}`] = dataRecorder;
          allRunningStatus[`${recorderId}`] = {
            isRunning: true,
            model: name,
            startedTime,
            endTime: null,
            logFile,
          };
          res.send({
            model,
            status: allRunningStatus,
          });
        }
      }
    }
  }
};

// Start a data recorder
router.post("/start", validate({ body: dataRecorderStartBody }), (req, res, next) => {
  const { model, dataRecorderFileName } = req.body;
  if (dataRecorderFileName) {
    // start recorder by file name
    const dataRecorderFile = resolveWithin(dataRecordersPath, dataRecorderFileName);
    if (!dataRecorderFile) {
      return sendBadRequest(res, "Invalid data recorder file name");
    }
    readJSONFile(dataRecorderFile, (err, data) => {
      if (err) {
        next(
          fileError(
            err,
            "Data recorder not found",
            "Cannot read the data recorder file"
          )
        );
      } else {
        startRecorder(data, res, next);
      }
    });
  } else {
    // Start recorder by model
    startRecorder(model, res, next);
  }
});

// Read the list of data recorders
router.get("/models/", validate(), (req, res, next) => {
  readDir(dataRecordersPath, (err, files) => {
    if (err) {
      next(internal("Cannot read the data recorders directory", err));
    } else {
      res.send({
        error: null,
        dataRecorders: files.filter((f) => path.extname(f) === ".json"),
      });
    }
  });
});

// Read a specific data recorder by its name:
router.get("/models/:fileName", validate({ params: { fileName: recorderNameParam } }), function (req, res, next) {
  const { fileName } = req.params;
  const dataRecorderFile = resolveWithin(dataRecordersPath, fileName);
  if (!dataRecorderFile) {
    return sendBadRequest(res, "Invalid data recorder name");
  }
  readJSONFile(dataRecorderFile, (err, data) => {
    if (err) {
      next(
        fileError(
          err,
          "Data recorder not found",
          "Cannot read the data recorder file"
        )
      );
    } else {
      res.send({
        error: null,
        dataRecorder: data,
      });
    }
  });
});

const updateDataRecorder = (fileName, dataRecorder, res, next) => {
  const { name } = dataRecorder;
  // Containment, not validation: the schema has already established that the
  // name is well formed, but the path it derives is still checked at the sink.
  if (!isValidName(name)) {
    return sendBadRequest(res, "Invalid data recorder name");
  }
  const newName = `${name}.json`;
  const oldDataRecorderFile = resolveWithin(dataRecordersPath, fileName);
  const newDataRecorderFile = resolveWithin(dataRecordersPath, newName);
  if (!oldDataRecorderFile || !newDataRecorderFile) {
    return sendBadRequest(res, "Invalid data recorder name");
  }
  if (newName === fileName) {
    writeToFile(
      newDataRecorderFile,
      JSON.stringify(dataRecorder),
      (err, data) => {
        if (err) {
          next(internal("Cannot save the new configuration", err));
        } else {
          res.send({
            dataRecorderFileName: fileName,
          });
        }
      },
      true
    );
  } else {
    // new file
    writeToFile(
      newDataRecorderFile,
      JSON.stringify(dataRecorder),
      (err, data) => {
        if (err) {
          next(internal("Cannot save the new configuration", err));
        } else {
          deleteFile(oldDataRecorderFile, (err2) => {
            if (err2) {
              next(internal("Cannot remove the old data recorder file", err2));
            } else {
              res.send({
                dataRecorderFileName: fileName,
              });
            }
          });
        }
      },
      true
    );
  }
};

const duplicateDataRecorder = (fileName, res, next) => {
  const dataRecorderFile = resolveWithin(dataRecordersPath, fileName);
  if (!dataRecorderFile) {
    return sendBadRequest(res, "Invalid data recorder name");
  }
  readJSONFile(dataRecorderFile, (err, data) => {
    if (err) {
      next(
        fileError(
          err,
          "Data recorder not found",
          "Cannot read the data recorder file"
        )
      );
    } else {
      const newName = `${data.name} [Duplicated]`;
      const newDataRecorder = {
        ...data,
        name: newName,
      };
      if (!isValidName(newName)) {
        return sendBadRequest(res, "Invalid data recorder name");
      }
      const newFileName = `${newName}.json`;
      const newDataRecorderFile = resolveWithin(dataRecordersPath, newFileName);
      if (!newDataRecorderFile) {
        return sendBadRequest(res, "Invalid data recorder name");
      }
      writeToFile(
        newDataRecorderFile,
        JSON.stringify(newDataRecorder),
        (err, dupDataRecorder) => {
          if (err) {
            next(internal("Cannot save the duplicated data recorder", err));
          } else {
            res.send({
              dataRecorderFileName: newFileName,
            });
          }
        },
        true
      );
    }
  });
};

// Update a data recorder
router.post("/models/:fileName", validate({ params: { fileName: recorderNameParam }, body: dataRecorderUpdateBody }), function (req, res, next) {
  const { fileName } = req.params;

  const { dataRecorder, isDuplicated } = req.body;
  if (isDuplicated) {
    duplicateDataRecorder(fileName, res, next);
  } else {
    updateDataRecorder(fileName, dataRecorder, res, next);
  }
});

// Save a new dataRecorder
router.post("/models", validate({ body: dataRecorderCreateBody }), function (req, res, next) {
  const { dataRecorder } = req.body;
  const { name } = dataRecorder;
  // Containment, not validation: the schema has already established that the
  // name is well formed, but the path it derives is still checked at the sink.
  if (!isValidName(name)) {
    return sendBadRequest(res, "Invalid data recorder name");
  }
  const dataRecorderFileName = `${dataRecorder.name}.json`;
  const dataRecorderFile = resolveWithin(dataRecordersPath, dataRecorderFileName);
  if (!dataRecorderFile) {
    return sendBadRequest(res, "Invalid data recorder name");
  }
  writeToFile(dataRecorderFile, JSON.stringify(dataRecorder), (err, data) => {
    if (err) {
      next(internal("Cannot save the new configuration", err));
    } else {
      res.send({
        error: null,
        dataRecorderFileName,
      });
    }
  });
});

// Delete a data recorder
router.delete("/models/:fileName", validate({ params: { fileName: recorderNameParam } }), function (req, res, next) {
  const { fileName } = req.params;
  const dataRecorderFile = resolveWithin(dataRecordersPath, fileName);
  if (!dataRecorderFile) {
    return sendBadRequest(res, "Invalid data recorder name");
  }
  deleteFile(dataRecorderFile, (err) => {
    if (err) {
      next(
        fileError(
          err,
          "Data recorder not found",
          "Cannot delete the data recorder file"
        )
      );
    } else {
      res.send({
        error: null,
        result: true,
      });
    }
  });
});

// Attached to the router itself as well as to the application: see the note in
// `routes/model.js`.
router.use(errorHandler);

module.exports = router;
