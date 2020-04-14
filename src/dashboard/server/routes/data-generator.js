/* Working with Data Generator */
var express = require("express");
var router = express.Router();
const {
  readJSONFile,
  readTextFile,
  writeToFile,
  readDir,
  deleteFile
} = require("../../../utils");
const {
  startGenerator,
  stopGenerator
} = require("../../../data-generators");
const getLogger = require("../logger");

const configFilePath = `${__dirname}/../data/data-generator.json`;
const logFilePath = `${__dirname}/../logs/data-generators/`;

router.get("/logs", (req, res, next) => {
  readDir(logFilePath, (err, files) => {
    if (err) {
      console.error("[SERVER]", err);
      res.send({ error: "Cannot read the logs directory" });
    } else {
      res.send({ error: null, files });
    }
  });
});

router.get("/logs/:fileName", function(req, res, next) {
  const { fileName } = req.params;
  const logFile = `${logFilePath}${fileName}`;
  readTextFile(logFile, (err, content) => {
    if (err) {
      console.error("[SERVER]", err);
      res.send({ error: "Cannot read the log file" });
    } else {
      res.send({ error: null, content });
    }
  });
});

router.post("/logs/:fileName", function(req, res, next) {
  const { fileName } = req.params;
  const logFile = `${logFilePath}${fileName}`;
  deleteFile(logFile, err => {
    if (err) {
      console.error("[SERVER]", err);
      res.send({ error: "Cannot delete the log file" });
    } else {
      res.send({ error: null, result: true });
    }
  });
});

let deployStatus = false;

router.get("/run", function(req, res, next) {
  if (deployStatus) {
    return res.send({
      error:
        "A data-generator is running. Only one data-generator can be running"
    });
  }
  readJSONFile(configFilePath, (err, generatorConfig) => {
    if (err) {
      console.error("[SERVER] ERROR: ", err);
      res.send({ error: "Cannot read the configuration file" });
    } else {
      // Check if there is a configuration
      if (generatorConfig) {
        // Logger
        const { name, generators } = generatorConfig;
        if (!name || !generators) {
          res.send({ error: "Invalid model", model: generatorConfig });
        } else {
          const startedTime = Date.now();
          const logFile = `${name}_${startedTime}.log`;
          getLogger("Data-Generator", `${logFilePath}${logFile}`);
          startGenerator(generators);
          deployStatus = {
            startedTime,
            logFile,
            model: name
          };
          res.send({ error: null, model: generatorConfig, deployStatus });
        }
      } else {
        res.send({ error: "Model is null" });
      }
    }
  });
});

router.post("/execute", function(req, res, next) {
  const generatorConfig = req.body.model;
  // Check if the simulation is running
  if (deployStatus) {
    res.send({
      error:
        "A data-generator is running. Only one data-generator can be running"
    });
  } else {
    // Check if there is a configuration
    if (generatorConfig) {
      // Logger
      const { name, generators } = generatorConfig;
      if (!name || !generators) {
        res.send({ error: "Invalid model", model: generatorConfig });
      } else {
        const startedTime = Date.now();
        const logFile = `${name}_${startedTime}.log`;
        getLogger("Data-Generator", `${logFilePath}${logFile}`);
        startGeneratingData(generators);
        deployStatus = {
          startedTime,
          logFile,
          model: name
        };
        res.send({ error: null, model: generatorConfig, deployStatus });
      }
    } else {
      res.send({ error: "Model is null" });
    }
  }
});

router.get("/stop", function(req, res, next) {
  let copiedStatus = deployStatus;
  if (deployStatus) {
    stopGenerator();
    deployStatus = null;
  }
  res.send({ error: null, deployStatus: copiedStatus });
});

router.get("/status", (req, res, next) => {
  res.send({ error: null, deployStatus });
});

router.get("/", function(req, res, next) {
  readJSONFile(configFilePath, (err, data) => {
    if (err) {
      console.error("[SERVER]", err);
      res.send({ error: err });
    } else {
      res.send({ error: null, model: data });
    }
  });
});

router.post("/", (req, res, next) => {
  const newConfig = req.body.model;
  writeToFile(configFilePath, JSON.stringify(newConfig), (err, data) => {
    if (err) {
      console.error("[SERVER] ERROR: ", err);
      res.send({ error: "Cannot save the new configuration" });
    } else {
      res.send({ error: null, model: newConfig });
    }
  });
});

module.exports = router;
