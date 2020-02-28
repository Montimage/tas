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
      res.send('Cannot read the log file');
    } else {
      res.send(content);
    }
  })
});

router.get('/run', function(req, res, next) {
  readJSONFile(configFilePath, (err, thingConfigs) => {
    if (err) {
      res.send({error: 'Cannot read the configuration file'});
    } else {
      startSimulation(thingConfigs);
      res.send({error: null, data: thingConfigs});
    }
  })
});

router.get('/stop', function(req, res, next) {
  stopSimulation();
  res.send({error: null});
});

router.get('/', function(req, res, next) {
  readJSONFile(configFilePath, (err, data) => {
    if (err) {
      console.error(err);
      res.send({});
    } else {
      console.log(data);
      res.send(data);
    }
  });
});

router.post('/', (req, res, next) => {
  const newConfig = req.body.data;
  writeToFile(configFilePath, JSON.stringify(newConfig), (err, data) => {
    if (err) {
      console.error(err);
      res.send({error: 'Cannot save the new configuration'});
    } else {
      res.send({error: null, data: newConfig});
    }
  });
})

module.exports = router;
