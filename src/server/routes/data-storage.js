/* Working with Data Generator */
var express = require("express");
const {
  readJSONFile,
  writeToFile,
} = require("../../core/utils");

const dataStoragePath = `${__dirname}/../data/data-storage.json`;
let router = express.Router();

///////////////
// Data Storage
///////////////
// Read a specific model by its name:
router.get("/", function (req, res, next) {
  readJSONFile(dataStoragePath, (err, data) => {
    if (err) {
      console.error("[SERVER]", err);
      res.send({
        error: "No default data storage",
        dataStorage: {
          protocol: "MONGODB",
          host: "localhost",
          port: 27017,
          username: null,
          password: null,
          dbname: null,
          options: null,
        },
      });
    } else {
      res.send({
        error: null,
        dataStorage: data
      });
    }
  });
});

// Save the default data storage
router.post("/", function (req, res, next) {
  const {
    dataStorage
  } = req.body;
  if (!dataStorage) {
    console.error("[SERVER]", "Cannot find data storage in body");
    return res.send({
      error: "Cannot find data storage in body"
    });
  }
  writeToFile(dataStoragePath, JSON.stringify(dataStorage), (err, data) => {
    if (err) {
      console.error("[SERVER]", err);
      res.send({
        error: "Cannot save the new data storage configuration"
      });
    } else {
      res.send({
        error: null,
        dataStorage
      });
    }
  }, true);
});

// Test the connection to the default data storage
router.get('/test', (req, res, next) => {
  res.send('Not implemented yet!');
});


module.exports = router;