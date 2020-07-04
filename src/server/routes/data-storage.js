/* Working with Data Generator */
var express = require("express");
const {
  getDataStorage,
  dbConnector,
  updateDataStorage
} = require('./db-connector');
let router = express.Router();

router.get("/", function (req, res, next) {
  getDataStorage((err, dataStorage) => {
    if (err) {
      res.send({
        error: 'Cannot get data storage'
      });
    } else {
      res.send({
        dataStorage
      });
    }
  })
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
  updateDataStorage(dataStorage, (err, ds) => {
    if (err) {
      res.send({
        error: 'Failed to update data storage'
      });
    } else {
      res.send({
        dataStorage: ds
      });
    }
  });
});

// Test the connection to the default data storage
router.get('/test', dbConnector, (req, res, next) => {
  res.send(true);
});


module.exports = router;