/* Working with Data Generator */
var express = require('express');
var router = express.Router();
const { readJSONFile, readTextFile, writeToFile } = require('../../../utils');
const { startGeneratingData, stopGeneratingData } = require('../../../data-generators');
const configFilePath = `${__dirname}/../data/data-generator.json`;
const logFilePath = `${__dirname}/../../data-generator.log`;

router.get('/logs', function(req, res, next) {
  readTextFile(logFilePath, (err, content) => {
    if (err) {
      console.error('[REST_API_SERVER] ERROR: ', err);
      res.send({error: 'Cannot read the log file'});
    } else {
      res.send({error: null, content});
    }
  })
});

let isStarted = false;

router.get('/run', function(req, res, next) {
  readJSONFile(configFilePath, (err, generatorConfig) => {
    if (err) {
      console.error('[REST_API_SERVER] ERROR: ', err);
      res.send({error: 'Cannot read the configuration file'});
    } else {
      if (!isStarted) {
        startGeneratingData(generatorConfig);
        isStarted = true;
      }
      res.send({error: null, data: generatorConfig});
    }
  })
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
      console.error('[REST_API_SERVER] ERROR: ', err);
      res.send({});
    } else {
      res.send(data);
    }
  });
});

router.post('/', (req, res, next) => {
  const newConfig = req.body.data;
  writeToFile(configFilePath, JSON.stringify(newConfig), (err, data) => {
    if (err) {
      console.error('[REST_API_SERVER] ERROR: ', err);
      res.send({error: 'Cannot save the new configuration'});
    } else {
      res.send({error: null, data: newConfig});
    }
  });
})

module.exports = router;
