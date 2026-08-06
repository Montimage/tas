/* Working with Data Generator */
var express = require("express");
const Joi = require("joi");
const {
  getDataStorage,
  dbConnector,
  updateDataStorage
} = require('./db-connector');
let router = express.Router();
const {
  validate,
  dataStorageSchema,
} = require("../middleware/validate");
const { errorHandler, internal } = require("../middleware/errors");

// ---------------------------------------------------------------------------
// Validation schemas for the data-storage endpoints (issue #10)
// ---------------------------------------------------------------------------

// The persisted shape `db-connector` reads back: a protocol plus the
// connection settings it destructures as `connConfig`. Declared in the
// middleware because a simulation may carry a connection of its own, and the
// two paths must agree on what a safe connection looks like.
const dataStorageBody = Joi.object({
  dataStorage: dataStorageSchema.required(),
}).required();

router.get("/", validate(), function (req, res, next) {
  getDataStorage((err, dataStorage) => {
    if (err) {
      next(internal('Cannot get data storage', err));
    } else {
      res.send({
        dataStorage
      });
    }
  })
});

// Save the default data storage
router.post("/", validate({ body: dataStorageBody }), function (req, res, next) {
  const {
    dataStorage
  } = req.body;
  updateDataStorage(dataStorage, (err, ds) => {
    if (err) {
      next(internal('Failed to update data storage', err));
    } else {
      res.send({
        dataStorage: ds
      });
    }
  });
});

// Test the connection to the default data storage
router.get('/test', validate(), dbConnector, (req, res, next) => {
  res.send({connectionStatus: true});
});


// Attached to the router itself as well as to the application: see the note in
// `routes/model.js`.
router.use(errorHandler);

module.exports = router;
