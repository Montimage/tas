/* Working with Data Generator */
var express = require('express');
var router = express.Router();
const { readJSONFile, readTextFile, writeToFile, readDir } = require('../../../utils');
const { startSimulation, stopSimulation } = require('../../../things');
const getLogger = require('../logger');

const configFilePath = `${__dirname}/../data/simulation.json`;
const logFilePath = `${__dirname}/../logs/simulations/`;

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
  readJSONFile(configFilePath, (err, thingConfigs) => {
    if (err) {
      res.send({error: 'Cannot read the configuration file'});
    } else {
      if (!isStarted) {
        // Logger
        const logger = getLogger('Simulation', `${logFilePath}simulation_${Date.now()}.log`);
        startSimulation(thingConfigs.things);
        isStarted = true;
      }
      res.send({error: null, model: thingConfigs});
    }
  })
});

router.post('/execute', function(req, res, next) {
  const thingConfigs = req.body.model;
  // Check if the simulation is running
  if (isStarted) {
    res.send({error: 'A simulation is running. Only one simulation can be running'});
  } else {
    // Check if there is a configuration
    if (thingConfigs) {
      // Logger
      const {name, things} = thingConfigs;
      if (!name || !things) {
        res.send({error: 'Invalid model', model: thingConfigs});
      } else {
        getLogger('Simulation', `${logFilePath}${name}_${Date.now()}.log`);
        startSimulation(things);
        isStarted = true;
        res.send({error: null, model: thingConfigs});
      }
    }
  }
});

router.get('/stop', function(req, res, next) {
  stopSimulation();
  isStarted = false;
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
  if (newConfig) {
    writeToFile(configFilePath, JSON.stringify(newConfig), (err, data) => {
      if (err) {
        console.error('[REST_API_SERVER]',err);
        res.send({error: 'Cannot save the new configuration'});
      } else {
        res.send({error: null, model: newConfig});
      }
    });
  } else {
    res.send({error: 'Invalid configuration!'});
  }
})

module.exports = router;
