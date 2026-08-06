/* Working with event */
const express = require("express");
const Joi = require("joi");
const router = express.Router();
const { EventSchema, dbConnector } = require("./db-connector");
const {
  validate,
  documentSchema,
  idSchema,
  pageSchema,
  textSchema,
  timestampSchema,
} = require("../middleware/validate");

// ---------------------------------------------------------------------------
// Validation schemas for the event endpoints (issue #10)
// ---------------------------------------------------------------------------

const eventIdParam = idSchema.required();

// `datasetId` and `topic` are copied straight into the Mongo filter below, so
// declaring them as strings is what stops `?datasetId[$ne]=x` from becoming an
// operator document that matches every event in the collection.
const eventQuery = Joi.object({
  page: pageSchema.default(0),
  startTime: timestampSchema,
  endTime: timestampSchema,
  datasetId: idSchema,
  topic: textSchema,
});

const eventFields = {
  timestamp: timestampSchema,
  topic: textSchema,
  datasetId: idSchema,
  isSensorData: Joi.boolean(),
  values: Joi.object(),
};

const eventCreateBody = Joi.object({
  event: documentSchema({
    ...eventFields,
    timestamp: timestampSchema.required(),
    topic: textSchema.required(),
    datasetId: idSchema.required(),
  }).required(),
}).required();

const eventUpdateBody = Joi.object({
  event: documentSchema(eventFields).required(),
}).required();

// Get all the events
router.get("/", validate({ query: eventQuery }), dbConnector, function (req, res, next) {
  let page = Number(req.query.page);
  if (!page) page = 0;
  let filter = {};
  let startTime = req.query.startTime;
  if (!startTime) {
    startTime = 0;
  }
  let endTime = req.query.endTime;
  if (!endTime) {
    endTime = Date.now();
  }
  filter = {
    ...filter,
    $and: [
      {
        timestamp: {
          $gte: Number(startTime),
        },
      },
      {
        timestamp: {
          $lte: Number(endTime),
        },
      },
    ],
  };
  const datasetId = req.query.datasetId;
  if (datasetId) {
    filter = { ...filter, datasetId };
  }
  const topic = req.query.topic;
  if (topic) {
    filter = { ...filter, topic };
  }
  if (page === 0) {
    EventSchema.countDocuments(filter, (err3, totalNbEvents) => {
      if (err3) {
        console.error("[SERVER] Failed to count number of event", err3);
        res.send({
          error: "Failed to count number of event",
        });
      } else {
        EventSchema.findEventsWithPagingOptions(filter, page, (err2, events) => {
          if (err2) {
            console.error("[SERVER] Failed to get events", err2);
            res.send({
              error: "Failed to get event",
            });
          } else {
            res.send({
              totalNbEvents,
              events,
            });
          }
      });
    }
  });
  } else {
    EventSchema.findEventsWithPagingOptions(filter, page, (err2, events) => {
      if (err2) {
        console.error("[SERVER] Failed to get events", err2);
        res.send({
          error: "Failed to get event",
        });
      } else {
        res.send({
          events,
        });
      }
    });
  }
});

/**
 * Get a event by id
 */
router.get("/:eventId", validate({ params: { eventId: eventIdParam } }), dbConnector, function (req, res, next) {
  const { eventId } = req.params;

  EventSchema.findById(eventId, (err2, event) => {
    if (err2) {
      console.error("[SERVER] Failed to get events", err2);
      res.send({
        error: "Failed to get event",
      });
    } else {
      res.send({
        event,
      });
    }
  });
});

// Add a new event
router.post("/", validate({ body: eventCreateBody }), dbConnector, function (req, res, next) {
  const { event } = req.body;
  const { timestamp, topic, datasetId, isSensorData, values } = event;
  const newevent = new EventSchema({
    timestamp,
    topic,
    datasetId,
    isSensorData,
    values,
  });
  newevent.save((err, _event) => {
    if (err) {
      console.error("[SERVER] Failed to save the events", err);
      res.send({
        error: "Failed to save the event",
      });
    } else {
      res.send({
        event: _event,
      });
    }
  });
});

/**
 * Update a event
 */
router.post("/:eventId", validate({ params: { eventId: eventIdParam }, body: eventUpdateBody }), dbConnector, function (req, res, next) {
  const { event } = req.body;
  const { eventId } = req.params;

  EventSchema.findByIdAndUpdate(eventId, event, (err, ts) => {
    if (err) {
      console.error("[SERVER] Failed to save the events", err);
      res.send({
        error: "Failed to save the event",
      });
    } else {
      res.send({
        event: ts,
      });
    }
  });
});

/**
 * Delete a event by id
 */
router.delete("/:eventId", validate({ params: { eventId: eventIdParam } }), dbConnector, function (req, res, next) {
  const { eventId } = req.params;

  EventSchema.findByIdAndDelete(eventId, (err, ret) => {
    if (err) {
      console.error("[SERVER] Failed to delete a event", err);
      res.send({
        error: "Failed to delete a event",
      });
    } else {
      res.send({
        result: ret,
      });
    }
  });
});

module.exports = router;
