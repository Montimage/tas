/* Working with Data Generator */
var express = require('express');
var router = express.Router();
const { readJSONFile, readTextFile, writeToFile, readDir } = require('../../../utils');
const { startGeneratingData, stopGeneratingData } = require('../../../data-generators');
const getLogger = require('../logger');

const configFilePath = `${__dirname}/../data/data-generator.json`;
const logFilePath = `${__dirname}/../logs/data-generators/`;


router.get('/logs', (req, res, next)=>{
  readDir(logFilePath, (err, files) => {
    if (err) {
      res.send({error: 'Cannot read the logs directory'});
    } else {
      res.send({error: null, files});
    }
  })
});

router.get('/logs/:fileName', function(req, res, next) {
  const {fileName} = req.params;
  const logFile = `${logFilePath}${fileName}`;
  readTextFile(logFile, (err, content) => {
    if (err) {
      res.send({error: 'Cannot read the log file'});
    } else {
      res.send({error: null, content});
    }
  });
});

let isStarted = false;

router.get('/run', function(req, res, next) {
  readJSONFile(configFilePath, (err, generatorConfig) => {
    if (err) {
      console.error('[REST_API_SERVER] ERROR: ', err);
      res.send({error: 'Cannot read the configuration file'});
    } else {
      if (!isStarted) {
        // Logger
        getLogger('Data-Generator', `${logFilePath}data-generator_${Date.now()}.log`);
        startGeneratingData(generatorConfig);
        isStarted = true;
      }
      res.send({error: null, model: generatorConfig});
    }
  })
});

router.post('/execute', function(req, res, next) {
  const generatorConfig = req.body.model;
  // Check if the simulation is running
  if (isStarted) {
    res.send({error: 'A simulation is running. Only one simulation can be running'});
  } else {
    // Check if there is a configuration
    if (generatorConfig) {
      // Logger
      const {name, dbConfig } = generatorConfig;
      if (!name || !dbConfig) {
        res.send({error: 'Invalid model', model: generatorConfig});
      } else {
        getLogger('Data-Generator', `${logFilePath}${name}_${Date.now()}.log`);
        startGeneratingData(generatorConfig);
        isStarted = true;
        res.send({error: null, model: generatorConfig});
      }
    }
  }
});

router.get('/stop', function(req, res, next) {
  if (isStarted) {
    stopGeneratingData();
    isStarted = false;
  }
  res.send({error: null});
});

router.get('/status', (req, res, next) => {
  res.send(isStarted);
})

router.get('/', function(req, res, next) {
  readJSONFile(configFilePath, (err, data) => {
    if (err) {
      console.error('[REST_API_SERVER]',err);
      res.send({error: err});
    } else {
      res.send({error: null, model: data});
    }
  });
});

router.post('/', (req, res, next) => {
  const newConfig = req.body.model;
  writeToFile(configFilePath, JSON.stringify(newConfig), (err, data) => {
    if (err) {
      console.error('[REST_API_SERVER] ERROR: ', err);
      res.send({error: 'Cannot save the new configuration'});
    } else {
      res.send({error: null, model: newConfig});
    }
  });
})

module.exports = router;
