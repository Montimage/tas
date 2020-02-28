/* Working with Data Generator */
var express = require('express');
var router = express.Router();
const { readJSONFile, readTextFile, writeToFile } = require('../../../utils');
const { startGeneratingData, stopGeneratingData } = require('../../../data-generators');
const configFilePath = `${__dirname}/../data/data-generator.json`;
const logFilePath = `${__dirname}/../logs/data-generator.log`;

router.get('/logs', function(req, res, next) {
  readTextFile(logFilePath, (err, content) => {
    if (err) {
      res.send({error: 'Cannot read the log file'});
    } else {
      res.send({error: null, logs: content});
    }
  })
});

router.get('/run', function(req, res, next) {
  readJSONFile(configFilePath, (err, generatorConfig) => {
    if (err) {
      res.send({error: 'Cannot read the configuration file'});
    } else {
      startGeneratingData(generatorConfig);
      res.send({error: null, data: generatorConfig});
    }
  })
});

router.get('/stop', function(req, res, next) {
  stopGeneratingData();
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