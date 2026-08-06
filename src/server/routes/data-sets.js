/* Working with data set */
const express = require("express");
const Joi = require("joi");
const EventSchema = require("../../core/enact-mongoose/schemas/EventSchema");
const router = express.Router();
const { DatasetSchema, dbConnector } = require("./db-connector");
const {
  validate,
  documentSchema,
  idSchema,
  pageSchema,
  textSchema,
} = require("../middleware/validate");

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
  description: textSchema.allow(null, ""),
  source: textSchema.allow(null, ""),
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

router.get("/", validate({ query: datasetQuery }), dbConnector, function (req, res, next) {
  let page = req.query.page;
  if (!page) page = 0;
  DatasetSchema.findDatasetsWithPagingOptions(null, page, (err2, datasets) => {
    if (err2) {
      console.error("[SERVER] Failed to get datasets", err2);
      res.send({
        error: "Failed to get data set",
      });
    } else {
      res.send({
        datasets,
      });
    }
  });
});

/**
 * Get a data set by id
 */
router.get("/:datasetId", validate({ params: { datasetId: datasetIdParam } }), dbConnector, function (req, res, next) {
  const { datasetId } = req.params;

  DatasetSchema.findOne({ id: datasetId }, (err2, dataset) => {
    if (err2) {
      console.error("[SERVER] Failed to get datasets", err2);
      res.send({
        error: "Failed to get data set",
      });
    } else {
      res.send({
        dataset,
      });
    }
  });
});

// Add a new data set
router.post("/", validate({ body: datasetCreateBody }), dbConnector, function (req, res, next) {
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
  newdataset.save((err, _dataset) => {
    if (err) {
      console.error("[SERVER] Failed to save the data sets", err);
      res.send({
        error: "Failed to save the data set",
      });
    } else {
      res.send({
        dataset: _dataset,
      });
    }
  });
});

/**
 * Update a data set
 */
router.post("/:datasetId", validate({ params: { datasetId: datasetIdParam }, body: datasetUpdateBody }), dbConnector, function (req, res, next) {
  const { dataset } = req.body;
  const { datasetId } = req.params;

  DatasetSchema.findOneAndUpdate(
    { id: datasetId },
    { ...dataset, lastModified: Date.now() },
    (err, ts) => {
      if (err) {
        console.error("[SERVER] Failed to save the data sets", err);
        res.send({
          error: "Failed to save the data set",
        });
      } else {
        res.send({
          dataset: ts,
        });
      }
    }
  );
});

/**
 * Delete a data set by id
 */
router.delete("/:datasetId", validate({ params: { datasetId: datasetIdParam } }), dbConnector, function (req, res, next) {
  const { datasetId } = req.params;

  DatasetSchema.findOneAndDelete({ id: datasetId }, (err, ret) => {
    if (err) {
      console.error("[SERVER] Failed to delete the data sets");
      console.error(err);
      res.send({
        error: "Failed to save the data set",
      });
    } else {
      EventSchema.deleteMany({ datasetId }, (err2) => {
        if (err2) {
          console.error(
            "[SERVER] Failed to delete all the event of the deleted dataset"
          );
          console.error(err2);
          res.send({
            error: "Failed to delete all the event of the deleted dataset",
          });
        } else {
          res.send({
            result: ret,
          });
        }
      });
    }
  });
});

module.exports = router;
