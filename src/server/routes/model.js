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
        models: files.filter(f => path.extname(f) === '.json')
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

const duplicateModel = (fileName, res) => {
  const modelFile = `${modelsPath}${fileName}`;
  readJSONFile(modelFile, (err, data) => {
    if (err) {
      console.error("[SERVER]", err);
      res.send({
        error: `Cannot read model ${fileName}`
      });
    } else {
      const newName = `${data.name} [Duplicated]`;
      const newModel = {...data, name: newName};
      const newFileName = `${newName}.json`;
      writeToFile(`${modelsPath}${newFileName}`, JSON.stringify(newModel), (err, dupModel) => {
        if (err) {
          console.error("[SERVER]", err);
          res.send({
            error: "Cannot save the duplicated model"
          });
        } else {
          res.send({
            modelFileName: newFileName
          });
        }
      }, true);
    }
  });
}

const updateModel = (model, fileName, res) => {
  
  if (!model) {
    console.error("[SERVER]", "Cannot find model in body");
    return res.send({
      error: "Cannot find model in body"
    });
  }

  const {
    name,
    devices
  } = model;
  if (!name || !devices) {
    console.error("[SERVER]", `Invalid model ${JSON.stringify(model)}`);
    return res.send({
      error: `Invalid model ${JSON.stringify(model)}`
    });
  }
  const newName = `${name}.json`;
  if (fileName === newName) {
    const modelFile = `${modelsPath}${fileName}`;
    writeToFile(modelFile, JSON.stringify(model), (err, data) => {
      if (err) {
        console.error("[SERVER]", err);
        res.send({
          error: "Cannot save the new configuration"
        });
      } else {
        res.send({
          modelFileName: fileName
        });
      }
    }, true);
  }
  else {
    const modelFile = `${modelsPath}${newName}`;
    const oldModelFile = `${modelsPath}${fileName}`;
    writeToFile(modelFile, JSON.stringify(model), (err, data) => {
      if (err) {
        console.error("[SERVER]", err);
        res.send({
          error: "Cannot save the new configuration"
        });
      } else {
        // Delete the old model
        deleteFile(oldModelFile, (err2) => {
          if (err2) {
            console.error(err2);
          }
          res.send({
            modelFileName: newName
          });
        });
      }
    }, true);
  }
};

// Update a model - or duplicate a model
router.post("/:fileName", function (req, res, next) {
  const {
    fileName
  } = req.params;

  const {
    model, isDuplicated
  } = req.body;
  if (isDuplicated) {
    // Duplicate the model
    duplicateModel(fileName, res);
  } else {
    // Update model
    updateModel(model, fileName, res);
  }  
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
    devices
  } = model;
  if (!name || !devices) {
    console.error("[SERVER]", `Invalid model ${JSON.stringify(model)}`);
    return res.send({
      error: `Invalid model ${JSON.stringify(model)}`
    });
  }

  const modelFileName = `${model.name}.json`;
  const modelFilePath = `${modelsPath}${modelFileName}`;
  writeToFile(modelFilePath, JSON.stringify(model), (err, data) => {
    if (err) {
      console.error("[SERVER]", err);
      res.send({
        error: "Cannot save the new configuration"
      });
    } else {
      res.send({
        modelFileName
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
        result: true
      });
    }
  });
});

module.exports = router;