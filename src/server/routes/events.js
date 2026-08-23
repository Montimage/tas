/* Working with event */
const express = require('express');
const Joi = require('joi');
const router = express.Router();
const { EventSchema, dbConnector } = require('./db-connector');
const {
  validate,
  documentSchema,
  idSchema,
  pageSchema,
  textSchema,
  timestampSchema,
} = require('../middleware/validate');
const { errorHandler, databaseError, notFound } = require('../middleware/errors');

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

// What the product actually records: the MQTT buses hand the handler
// `message.toString()`, so a sensor reading arrives as a string, while
// structured payloads arrive as objects — and the Mongoose path is Mixed, so it
// stores whichever of those it is given. The dashboard round-trips whichever it
// finds. Declared by shape rather than left as `any` so it still cannot be an
// unbounded structure, but not narrowed to an object: `values` never reaches a
// filter, so narrowing it buys no safety and only rejects real events. The
// security property on this document is that `datasetId` and `topic` are typed,
// which they are.
//
// Null is deliberately not among the branches: `EventSchema` declares `values`
// as required, and mongoose's required check rejects null, so admitting it here
// would turn a clean 400 into a save that fails behind a 200 — and the update
// route calls `findByIdAndUpdate` without `runValidators`, which would write it
// past the schema entirely.
const eventValueSchema = Joi.alternatives().try(
  Joi.object(),
  Joi.array(),
  Joi.string().max(8192),
  Joi.number(),
  Joi.boolean()
);

const eventFields = {
  timestamp: timestampSchema,
  topic: textSchema,
  datasetId: idSchema,
  isSensorData: Joi.boolean(),
  values: eventValueSchema,
};

// `values` and `isSensorData` are declared `required: true` by `EventSchema`,
// so a create that omits either is refused by mongoose after the request has
// been accepted. Requiring them here is what turns that into a 400 naming the
// field, instead of a save failure reported behind a success status. They stay
// optional on the update body below, which is a partial document.
const eventCreateBody = Joi.object({
  event: documentSchema({
    ...eventFields,
    timestamp: timestampSchema.required(),
    topic: textSchema.required(),
    datasetId: idSchema.required(),
    isSensorData: Joi.boolean().required(),
    values: eventValueSchema.required(),
  }).required(),
}).required();

const eventUpdateBody = Joi.object({
  event: documentSchema(eventFields).required(),
}).required();

// Get all the events
router.get('/', validate({ query: eventQuery }), dbConnector, async function (req, res, next) {
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
  try {
    if (page === 0) {
      let totalNbEvents;
      try {
        totalNbEvents = await EventSchema.countDocuments(filter);
      } catch (err3) {
        return next(databaseError(err3, 'Failed to count number of event'));
      }
      const events = await EventSchema.findEventsWithPagingOptions(filter, page);
      res.send({
        totalNbEvents,
        events,
      });
    } else {
      const events = await EventSchema.findEventsWithPagingOptions(filter, page);
      res.send({
        events,
      });
    }
  } catch (err2) {
    next(databaseError(err2, 'Failed to get event'));
  }
});

/**
 * Get a event by id
 */
router.get(
  '/:eventId',
  validate({ params: { eventId: eventIdParam } }),
  dbConnector,
  async function (req, res, next) {
    const { eventId } = req.params;

    try {
      const event = await EventSchema.findById(eventId);
      if (!event) {
        next(notFound('Event not found'));
      } else {
        res.send({
          event,
        });
      }
    } catch (err2) {
      next(databaseError(err2, 'Failed to get event'));
    }
  }
);

// Add a new event
router.post('/', validate({ body: eventCreateBody }), dbConnector, async function (req, res, next) {
  const { event } = req.body;
  const { timestamp, topic, datasetId, isSensorData, values } = event;
  const newevent = new EventSchema({
    timestamp,
    topic,
    datasetId,
    isSensorData,
    values,
  });
  try {
    const _event = await newevent.save();
    res.send({
      event: _event,
    });
  } catch (err) {
    next(databaseError(err, 'Failed to save the event'));
  }
});

/**
 * Update a event
 */
router.post(
  '/:eventId',
  validate({ params: { eventId: eventIdParam }, body: eventUpdateBody }),
  dbConnector,
  async function (req, res, next) {
    const { event } = req.body;
    const { eventId } = req.params;

    try {
      const ts = await EventSchema.findByIdAndUpdate(eventId, event);
      if (!ts) {
        return next(notFound('Event not found'));
      }
      res.send({
        event: ts,
      });
    } catch (err) {
      next(databaseError(err, 'Failed to save the event'));
    }
  }
);

/**
 * Delete a event by id
 */
router.delete(
  '/:eventId',
  validate({ params: { eventId: eventIdParam } }),
  dbConnector,
  async function (req, res, next) {
    const { eventId } = req.params;

    try {
      const ret = await EventSchema.findByIdAndDelete(eventId);
      res.send({
        result: ret,
      });
    } catch (err) {
      next(databaseError(err, 'Failed to delete a event'));
    }
  }
);

// Attached to the router itself as well as to the application: see the note in
// `routes/model.js`.
router.use(errorHandler);

module.exports = router;
