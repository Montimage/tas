/* Working with Data Generator */
var express = require("express");
var path = require("path");
const DataRecorder = require("../../core/data-recorder");

const {
  readJSONFile,
  writeToFile,
  readDir,
  deleteFile,
  getObjectId,
} = require("../../core/utils");
const dataRecordersPath = `${__dirname}/../data/data-recorders/`;
let router = express.Router();
let getLogger = require("../logger");
const { getDataStorage } = require("./db-connector");
let logsPath = `${__dirname}/../logs/data-recorders/`;
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

/**
 * Get the running status of data recorder
 */
router.get("/status", (req, res, next) => {
  res.send({
    status: allRunningStatus,
  });
});

// Stop the running data recorder
router.get("/stop/:fileName", function (req, res, next) {
  const { fileName } = req.params;
  if (!fileName) {
    console.error(`[data-recorders] Missing data recorder's name`);
    res.send({
      error: 'Missing data recorder name',
      runningStatus: allRunningStatus,
    });
  } else {
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
  }
});

const startRecorder = (model, res) => {
  if (!model) {
    console.error("[data-recorders] Cannot find data recorder configuration");
    res.send({
      error: "Cannot find data recorder configuration",
    });
  } else {
    const { name, dataRecorders, dataStorage } = model;
    if (!name || !dataRecorders) {
      console.error("[data-recorders] Invalid data recorder model");
      res.send({
        error: " Invalid data recorder model",
      });
    } else {
      const recorderId = getObjectId(name);
      if (allDataRecorders[recorderId]) {
        console.error("[data-recorders] Recorder has already started");
        console.error(name);
        res.send({
          error: `Recorder has already started ${name}`,
        });
      } else {
        const startedTime = Date.now();
        const logFile = `${name}_${startedTime}.log`;
        getLogger("DATA-RECORDER", `${logsPath}${logFile}`);
        if (!dataStorage) {
          // use default data storage
          getDataStorage((err, ds) => {
            if (err) {
              res.send({
                error: "No data storage",
              });
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
router.post("/start", (req, res, next) => {
  const { model, dataRecorderFileName } = req.body;
  if (dataRecorderFileName) {
    // start recorder by file name
    const dataRecorderFile = `${dataRecordersPath}${dataRecorderFileName}`;
    readJSONFile(dataRecorderFile, (err, data) => {
      if (err) {
        console.error(
          `[data-recorders] Cannot find data recorder ${dataRecorderFileName}`
        );
        res.send({
          error: `[data-recorders] Cannot find data recorder ${dataRecorderFileName}`,
        });
      } else {
        startRecorder(data, res);
      }
    });
  } else {
    // Start recorder by model
    startRecorder(model, res);
  }
});

// Read the list of data recorders
router.get("/models/", (req, res, next) => {
  readDir(dataRecordersPath, (err, files) => {
    if (err) {
      console.error("[SERVER]", err);
      res.send({
        error: "Cannot read the data recorders directory",
      });
    } else {
      res.send({
        error: null,
        dataRecorders: files.filter((f) => path.extname(f) === ".json"),
      });
    }
  });
});

// Read a specific data recorder by its name:
router.get("/models/:fileName", function (req, res, next) {
  const { fileName } = req.params;
  const dataRecorderFile = `${dataRecordersPath}${fileName}`;
  readJSONFile(dataRecorderFile, (err, data) => {
    if (err) {
      console.error("[SERVER]", err);
      res.send({
        error: err,
      });
    } else {
      res.send({
        error: null,
        dataRecorder: data,
      });
    }
  });
});

const updateDataRecorder = (fileName, dataRecorder, res) => {
  if (!dataRecorder) {
    console.error("[SERVER]", "Cannot find data recorder in body");
    return res.send({
      error: "Cannot find data recorder in body",
    });
  }

  const { name, dataRecorders } = dataRecorder;
  if (!name || !dataRecorders) {
    console.error(
      "[SERVER]",
      `Invalid dataRecorder ${JSON.stringify(dataRecorder)}`
    );
    return res.send({
      error: `Invalid dataRecorder ${JSON.stringify(dataRecorder)}`,
    });
  }
  const newName = `${name}.json`;
  if (newName === fileName) {
    const dataRecorderFile = `${dataRecordersPath}${fileName}`;
    writeToFile(
      dataRecorderFile,
      JSON.stringify(dataRecorder),
      (err, data) => {
        if (err) {
          console.error("[SERVER]", err);
          res.send({
            error: "Cannot save the new configuration",
          });
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
    const oldDataRecorderFile = `${dataRecordersPath}${fileName}`;
    const newDataRecorderFile = `${dataRecordersPath}${newName}`;
    writeToFile(
      newDataRecorderFile,
      JSON.stringify(dataRecorder),
      (err, data) => {
        if (err) {
          console.error("[SERVER]", err);
          res.send({
            error: "Cannot save the new configuration",
          });
        } else {
          deleteFile(oldDataRecorderFile, (err2) => {
            if (err2) {
              console.error("[SERVER]", err2);
              res.send({
                error: `Cannot remove the old data recorder file: ${fileName}`,
              });
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

const duplicateDataRecorder = (fileName, res) => {
  const dataRecorderFile = `${dataRecordersPath}${fileName}`;
  readJSONFile(dataRecorderFile, (err, data) => {
    if (err) {
      console.error("[SERVER] Cannot read data recorder: ", err);
      res.send({
        error: `Cannot read model ${fileName}`,
      });
    } else {
      const newName = `${data.name} [Duplicated]`;
      const newDataRecorder = {
        ...data,
        name: newName,
      };
      const newFileName = `${newName}.json`;
      writeToFile(
        `${dataRecordersPath}${newFileName}`,
        JSON.stringify(newDataRecorder),
        (err, dupDataRecorder) => {
          if (err) {
            console.error("[SERVER]", err);
            res.send({
              error: "Cannot save the duplicated model",
            });
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
router.post("/models/:fileName", function (req, res, next) {
  const { fileName } = req.params;

  const { dataRecorder, isDuplicated } = req.body;
  if (isDuplicated) {
    duplicateDataRecorder(fileName, res);
  } else {
    updateDataRecorder(fileName, dataRecorder, res);
  }
});

// Save a new dataRecorder
router.post("/models", function (req, res, next) {
  const { dataRecorder } = req.body;
  if (!dataRecorder) {
    console.error("[SERVER]", "Cannot find dataRecorder in body");
    return res.send({
      error: "Cannot find dataRecorder in body",
    });
  }

  const { name, dataRecorders } = dataRecorder;
  if (!name || !dataRecorders) {
    console.error(
      "[SERVER]",
      `Invalid dataRecorder ${JSON.stringify(dataRecorder)}`
    );
    return res.send({
      error: `Invalid dataRecorder ${JSON.stringify(dataRecorder)}`,
    });
  }
  const dataRecorderFileName = `${dataRecorder.name}.json`;
  const dataRecorderFile = `${dataRecordersPath}${dataRecorderFileName}`;
  writeToFile(dataRecorderFile, JSON.stringify(dataRecorder), (err, data) => {
    if (err) {
      console.error("[SERVER]", err);
      res.send({
        error: "Cannot save the new configuration",
      });
    } else {
      res.send({
        error: null,
        dataRecorderFileName,
      });
    }
  });
});

// Delete a data recorder
router.delete("/models/:fileName", function (req, res, next) {
  const { fileName } = req.params;
  const dataRecorderFile = `${dataRecordersPath}${fileName}`;
  deleteFile(dataRecorderFile, (err) => {
    if (err) {
      console.error("[SERVER]", err);
      res.send({
        error: "Cannot delete the data recorder file",
      });
    } else {
      res.send({
        error: null,
        result: true,
      });
    }
  });
});

module.exports = router;
