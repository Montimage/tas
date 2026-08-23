/* Working with data set */
const express = require('express');
const Joi = require('joi');
const EventSchema = require('../../core/enact-mongoose/schemas/EventSchema');
const router = express.Router();
const { DatasetSchema, dbConnector } = require('./db-connector');
const {
  validate,
  documentSchema,
  idSchema,
  pageSchema,
  textSchema,
} = require('../middleware/validate');
const { errorHandler, databaseError, notFound } = require('../middleware/errors');

// ---------------------------------------------------------------------------
// Validation schemas for the data-set endpoints (issue #10)
// ---------------------------------------------------------------------------

const datasetIdParam = idSchema.required();

const datasetQuery = Joi.object({
  page: pageSchema.default(0),
});

const datasetFields = {
  id: idSchema,
  name: textSchema,
  tags: Joi.array().items(Joi.string().max(256)),
  description: textSchema.allow(null, ''),
  source: textSchema.allow(null, ''),
};

const datasetCreateBody = Joi.object({
  dataset: documentSchema({
    ...datasetFields,
    id: idSchema.required(),
    name: textSchema.required(),
  }).required(),
}).required();

const datasetUpdateBody = Joi.object({
  dataset: documentSchema(datasetFields).required(),
}).required();

router.get('/', validate({ query: datasetQuery }), dbConnector, async function (req, res, next) {
  let page = req.query.page;
  if (!page) page = 0;
  try {
    const datasets = await DatasetSchema.findDatasetsWithPagingOptions(null, page);
    res.send({
      datasets,
    });
  } catch (err2) {
    next(databaseError(err2, 'Failed to get data set'));
  }
});

/**
 * Get a data set by id
 */
router.get(
  '/:datasetId',
  validate({ params: { datasetId: datasetIdParam } }),
  dbConnector,
  async function (req, res, next) {
    const { datasetId } = req.params;

    try {
      const dataset = await DatasetSchema.findOne({ id: datasetId });
      if (!dataset) {
        next(notFound('Data set not found'));
      } else {
        res.send({
          dataset,
        });
      }
    } catch (err2) {
      next(databaseError(err2, 'Failed to get data set'));
    }
  }
);

// Add a new data set
router.post(
  '/',
  validate({ body: datasetCreateBody }),
  dbConnector,
  async function (req, res, next) {
    const { dataset } = req.body;
    const { id, name, tags, description, source } = dataset;
    const currentTime = Date.now();
    const newdataset = new DatasetSchema({
      id,
      name,
      tags,
      description,
      source,
      createdAt: currentTime,
      lastModified: currentTime,
    });
    try {
      const _dataset = await newdataset.save();
      res.send({
        dataset: _dataset,
      });
    } catch (err) {
      next(databaseError(err, 'Failed to save the data set'));
    }
  }
);

/**
 * Update a data set
 */
router.post(
  '/:datasetId',
  validate({ params: { datasetId: datasetIdParam }, body: datasetUpdateBody }),
  dbConnector,
  async function (req, res, next) {
    const { dataset } = req.body;
    const { datasetId } = req.params;

    try {
      const ts = await DatasetSchema.findOneAndUpdate(
        { id: datasetId },
        { ...dataset, lastModified: Date.now() }
      );
      if (!ts) {
        return next(notFound('Data set not found'));
      }
      res.send({
        dataset: ts,
      });
    } catch (err) {
      next(databaseError(err, 'Failed to save the data set'));
    }
  }
);

/**
 * Delete a data set by id
 */
router.delete(
  '/:datasetId',
  validate({ params: { datasetId: datasetIdParam } }),
  dbConnector,
  async function (req, res, next) {
    const { datasetId } = req.params;

    try {
      const ret = await DatasetSchema.findOneAndDelete({ id: datasetId });
      try {
        await EventSchema.deleteMany({ datasetId });
      } catch (err2) {
        return next(databaseError(err2, 'Failed to delete all the event of the deleted dataset'));
      }
      res.send({
        result: ret,
      });
    } catch (err) {
      next(databaseError(err, 'Failed to delete the data set'));
    }
  }
);

// Attached to the router itself as well as to the application: see the note in
// `routes/model.js`.
router.use(errorHandler);

module.exports = router;
