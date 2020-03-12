/* Working with Data Generator */
var express = require('express');
var router = express.Router();
const { readJSONFile, readTextFile, writeToFile } = require('../../../utils');
const { startSimulation, stopSimulation } = require('../../../things');
const configFilePath = `${__dirname}/../data/simulation.json`;
const logFilePath = `${__dirname}/../logs/simulation.log`;

router.get('/logs', function(req, res, next) {
  readTextFile(logFilePath, (err, content) => {
    if (err) {
      res.send({error: 'Cannot read the log file'});
    } else {
      res.send({error: null, content});
    }
  })
});

let isStarted = false;

router.get('/run', function(req, res, next) {
  readJSONFile(configFilePath, (err, thingConfigs) => {
    if (err) {
      res.send({error: 'Cannot read the configuration file'});
    } else {
      if (!isStarted) {
        // Logger
        const getLogger = require('../logger');
        const logger = getLogger('Simulation', `${logFilePath}`);
        startSimulation(thingConfigs.things);
        isStarted = true;
      }
      res.send({error: null, data: thingConfigs});
    }
  })
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
  const newConfig = req.body.data;
  if (newConfig) {
    writeToFile(configFilePath, JSON.stringify(newConfig), (err, data) => {
      if (err) {
        console.error('[REST_API_SERVER]',err);
        res.send({error: 'Cannot save the new configuration'});
      } else {
        res.send({error: null, data: newConfig});
      }
    });
  } else {
    res.send({error: 'Invalid configuration!'});
  }
})

module.exports = router;
