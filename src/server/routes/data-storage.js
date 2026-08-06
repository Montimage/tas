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
  documentSchema,
} = require("../middleware/validate");

// ---------------------------------------------------------------------------
// Validation schemas for the data-storage endpoints (issue #10)
// ---------------------------------------------------------------------------

// The persisted shape `db-connector` reads back: a protocol plus the
// connection settings it destructures as `connConfig`.
const connConfigSchema = documentSchema({
  // Deliberately a character allowlist rather than a strict hostname check:
  // it still rules out the separators that would let a host rewrite the
  // connection string, without rejecting the service names an operator may
  // legitimately have configured.
  host: Joi.string().pattern(/^[A-Za-z0-9._-]+$/).max(253).required(),
  port: Joi.number().integer().min(1).max(65535).required(),
  username: Joi.string().max(256).allow(null, ""),
  password: Joi.string().max(256).allow(null, ""),
  dbname: Joi.string().max(256).allow(null, ""),
  options: Joi.object().allow(null),
}).required();

const dataStorageBody = Joi.object({
  dataStorage: documentSchema({
    protocol: Joi.string().valid("MONGODB").required(),
    connConfig: connConfigSchema,
  }).required(),
}).required();

router.get("/", validate(), function (req, res, next) {
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
router.post("/", validate({ body: dataStorageBody }), function (req, res, next) {
  const {
    dataStorage
  } = req.body;
  updateDataStorage(dataStorage, (err, ds) => {
    if (err) {
      console.error('[data-storage] Failed to update data storage',err);
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
router.get('/test', validate(), dbConnector, (req, res, next) => {
  res.send({connectionStatus: true});
});


module.exports = router;
