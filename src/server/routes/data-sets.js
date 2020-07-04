/* Working with data set */
const express = require("express");
const router = express.Router();
const {
  DataSetSchema,
  dbConnector
} = require('./db-connector');

router.get("/", dbConnector, function (req, res, next) {
  console.log(req.param('page'));
  let page = req.param('page');
  if (!page) page = 0;
  DataSetSchema.findDataSetsWithPagingOptions(null, page, (err2, dataSets) => {
    if (err2) {
      console.error('[SERVER] Failed to get dataSets', err2);
      res.send({
        error: 'Failed to get data set'
      });
    } else {
      res.send({
        dataSets
      });
    }
  });
});

/**
 * Get a data set by id
 */
router.get("/:dataSetId", dbConnector, function (req, res, next) {
  const {
    dataSetId
  } = req.params;

  DataSetSchema.findById(dataSetId, (err2, dataSet) => {
    if (err2) {
      console.error('[SERVER] Failed to get dataSets', err2);
      res.send({
        error: 'Failed to get data set'
      });
    } else {
      res.send({
        dataSet
      });
    }
  });
});

// Add a new data set
router.post("/", dbConnector, function (req, res, next) {
  const {
    dataSet
  } = req.body;
  const {
    id,
    name,
    tags,
    description,
    source,
  } = dataSet;
  const currentTime = Date.now();
  const newdataSet = new DataSetSchema({
    id,
    name,
    tags,
    description,
    source,
    createdAt: currentTime,
    lastModified: currentTime
  });
  newdataSet.save((err, _dataSet) => {
    if (err) {
      console.error('[SERVER] Failed to save the data sets', err);
      res.send({
        error: 'Failed to save the data set'
      });
    } else {
      res.send({
        dataSet: _dataSet
      });
    }
  });
});

/**
 * Update a data set
 */
router.post("/:dataSetId", dbConnector, function (req, res, next) {
  const {
    dataSet
  } = req.body;
  const {
    dataSetId
  } = req.params;

  DataSetSchema.findByIdAndUpdate(dataSetId, {...dataSet, lastModified: Date.now()}, (err, ts) => {
    if (err) {
      console.error('[SERVER] Failed to save the data sets', err);
      res.send({
        error: 'Failed to save the data set'
      });
    } else {
      res.send({
        dataSet: ts
      });
    }
  });
});

/**
 * Delete a data set by id
 */
router.delete("/:dataSetId", dbConnector, function (req, res, next) {
  const {
    dataSetId
  } = req.params;

  DataSetSchema.findByIdAndDelete(dataSetId, (err, ret) => {
    if (err) {
      console.error('[SERVER] Failed to save the data sets', err);
      res.send({
        error: 'Failed to save the data set'
      });
    } else {
      res.send({
        result: ret
      });
    }
  });
});



module.exports = router;