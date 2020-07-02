/* Working with Data Generator */
var express = require("express");
var path = require('path');

const {
  readJSONFile,
  writeToFile,
  readDir,
  deleteFile,
} = require("../../core/utils");
const modelsPath = `${__dirname}/../data/models/`;
let router = express.Router();

///////////////
// MODEL
///////////////

// Read the list of models
router.get("/", (req, res, next) => {
  readDir(modelsPath, (err, files) => {
    if (err) {
      console.error("[SERVER]", err);
      res.send({
        error: "Cannot read the models directory"
      });
    } else {
      res.send({
        error: null,
        files: files.filter(f => path.extname(f) === '.json')
      });
    }
  });
});

// Read a specific model by its name:
router.get("/:fileName", function (req, res, next) {
  const {
    fileName
  } = req.params;
  const modelFile = `${modelsPath}${fileName}`;
  readJSONFile(modelFile, (err, data) => {
    if (err) {
      console.error("[SERVER]", err);
      res.send({
        error: err
      });
    } else {
      res.send({
        error: null,
        model: data
      });
    }
  });
});

// Update a model
router.post("/:fileName", function (req, res, next) {
  const {
    fileName
  } = req.params;
  const modelFile = `${modelsPath}${fileName}`;
  const {
    model
  } = req.body;
  if (!model) {
    console.error("[SERVER]", "Cannot find model in body");
    return res.send({
      error: "Cannot find model in body"
    });
  }

  const {
    name,
    things
  } = model;
  if (!name || !things) {
    console.error("[SERVER]", `Invalid model ${JSON.stringify(model)}`);
    return res.send({
      error: `Invalid model ${JSON.stringify(model)}`
    });
  }

  writeToFile(modelFile, JSON.stringify(model), (err, data) => {
    if (err) {
      console.error("[SERVER]", err);
      res.send({
        error: "Cannot save the new configuration"
      });
    } else {
      res.send({
        error: null,
        model: model
      });
    }
  }, true);
});

// Save a new model
router.post("/", function (req, res, next) {
  const {
    model
  } = req.body;
  if (!model) {
    console.error("[SERVER]", "Cannot find model in body");
    return res.send({
      error: "Cannot find model in body"
    });
  }

  const {
    name,
    things
  } = model;
  if (!name || !things) {
    console.error("[SERVER]", `Invalid model ${JSON.stringify(model)}`);
    return res.send({
      error: `Invalid model ${JSON.stringify(model)}`
    });
  }

  let modelFile = `${modelsPath}_${model.name}.json`;
  writeToFile(modelFile, JSON.stringify(model), (err, data) => {
    if (err) {
      console.error("[SERVER]", err);
      res.send({
        error: "Cannot save the new configuration"
      });
    } else {
      res.send({
        error: null,
        model: model
      });
    }
  });
});

// Delete a model
router.delete("/:fileName", function (req, res, next) {
  const {
    fileName
  } = req.params;
  const modelFile = `${modelsPath}${fileName}`;
  deleteFile(modelFile, (err) => {
    if (err) {
      console.error("[SERVER]", err);
      res.send({
        error: "Cannot delete the model file"
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