/* Working with Data Generator */
var express = require("express");
var path = require('path');

const {
  readJSONFile,
  writeToFile,
  readDir,
  deleteFile,
} = require("../../core/utils");
const dataRecorderssPath = `${__dirname}/../data/data-recorders/`;
let router = express.Router();

///////////////
// DATA RECORDERS
///////////////

// Read the list of data recorders
router.get("/", (req, res, next) => {
  readDir(dataRecorderssPath, (err, files) => {
    if (err) {
      console.error("[SERVER]", err);
      res.send({
        error: "Cannot read the data recorders directory"
      });
    } else {
      res.send({
        error: null,
        files: files.filter(f => path.extname(f) === '.json')
      });
    }
  });
});

// Read a specific data recorder by its name:
router.get("/:fileName", function (req, res, next) {
  const {
    fileName
  } = req.params;
  const dataRecorderFile = `${dataRecorderssPath}${fileName}`;
  readJSONFile(dataRecorderFile, (err, data) => {
    if (err) {
      console.error("[SERVER]", err);
      res.send({
        error: err
      });
    } else {
      res.send({
        error: null,
        dataRecorder: data
      });
    }
  });
});

// Update a data recorder
router.post("/:fileName", function (req, res, next) {
  const {
    fileName
  } = req.params;
  const dataRecorderFile = `${dataRecorderssPath}${fileName}`;
  const {
    dataRecorder
  } = req.body;
  if (!dataRecorder) {
    console.error("[SERVER]", "Cannot find data recorder in body");
    return res.send({
      error: "Cannot find data recorder in body"
    });
  }

  const {
    name,
    dataRecorders
  } = dataRecorder;
  if (!name || !dataRecorders) {
    console.error("[SERVER]", `Invalid dataRecorder ${JSON.stringify(dataRecorder)}`);
    return res.send({
      error: `Invalid dataRecorder ${JSON.stringify(dataRecorder)}`
    });
  }

  writeToFile(dataRecorderFile, JSON.stringify(dataRecorder), (err, data) => {
    if (err) {
      console.error("[SERVER]", err);
      res.send({
        error: "Cannot save the new configuration"
      });
    } else {
      res.send({
        error: null,
        dataRecorder: dataRecorder
      });
    }
  },true);
});

// Save a new dataRecorder
router.post("/", function (req, res, next) {
  const {
    dataRecorder
  } = req.body;
  if (!dataRecorder) {
    console.error("[SERVER]", "Cannot find dataRecorder in body");
    return res.send({
      error: "Cannot find dataRecorder in body"
    });
  }

  const {
    name,
    dataRecorders
  } = dataRecorder;
  if (!name || !dataRecorders) {
    console.error("[SERVER]", `Invalid dataRecorder ${JSON.stringify(dataRecorder)}`);
    return res.send({
      error: `Invalid dataRecorder ${JSON.stringify(dataRecorder)}`
    });
  }

  let dataRecorderFile = `${dataRecorderssPath}_${dataRecorder.name}.json`;
  writeToFile(dataRecorderFile, JSON.stringify(dataRecorder), (err, data) => {
    if (err) {
      console.error("[SERVER]", err);
      res.send({
        error: "Cannot save the new configuration"
      });
    } else {
      res.send({
        error: null,
        dataRecorder: dataRecorder
      });
    }
  });
});

// Delete a data recorder
router.delete("/:fileName", function (req, res, next) {
  const {
    fileName
  } = req.params;
  const dataRecorderFile = `${dataRecorderssPath}${fileName}`;
  deleteFile(dataRecorderFile, (err) => {
    if (err) {
      console.error("[SERVER]", err);
      res.send({
        error: "Cannot delete the data recorder file"
      });
    } else {
      res.send({
        error: null,
        result: true
      });
    }
  });
});

module.exports = router;