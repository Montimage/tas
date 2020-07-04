/* Working with event */
const express = require("express");
const router = express.Router();
const {
  EventSchema,
  dbConnector
} = require('./db-connector');

// Get all the events
router.get("/", dbConnector, function (req, res, next) {
  console.log(req.param('page'));
  let page = req.param('page');
  if (!page) page = 0;
  let filter = null;
  const datasetId = req.param('datasetId');
  if (datasetId) {
    filter = {datasetId};    
  }
  EventSchema.findEventsWithPagingOptions(filter, page, (err2, events) => {
    if (err2) {
      console.error('[SERVER] Failed to get events', err2);
      res.send({
        error: 'Failed to get event'
      });
    } else {
      res.send({
        events
      });
    }
  });
});

/**
 * Get a event by id
 */
router.get("/:eventId", dbConnector, function (req, res, next) {
  const {
    eventId
  } = req.params;

  EventSchema.findById(eventId, (err2, event) => {
    if (err2) {
      console.error('[SERVER] Failed to get events', err2);
      res.send({
        error: 'Failed to get event'
      });
    } else {
      res.send({
        event
      });
    }
  });
});

// Add a new event
router.post("/", dbConnector, function (req, res, next) {
  const {
    event
  } = req.body;
  const {
    timestamp,
    topic,
    datasetId,
    isSensorData,
    values
  } = event;
  const newevent = new EventSchema({
    timestamp,
    topic,
    datasetId,
    isSensorData,
    values
  });
  newevent.save((err, _event) => {
    if (err) {
      console.error('[SERVER] Failed to save the events', err);
      res.send({
        error: 'Failed to save the event'
      });
    } else {
      res.send({
        event: _event
      });
    }
  });
});

/**
 * Update a event
 */
router.post("/:eventId", dbConnector, function (req, res, next) {
  const {
    event
  } = req.body;
  const {
    eventId
  } = req.params;

  EventSchema.findByIdAndUpdate(eventId, event, (err, ts) => {
    if (err) {
      console.error('[SERVER] Failed to save the events', err);
      res.send({
        error: 'Failed to save the event'
      });
    } else {
      res.send({
        event: ts
      });
    }
  });
});

/**
 * Delete a event by id
 */
router.delete("/:eventId", dbConnector, function (req, res, next) {
  const {
    eventId
  } = req.params;

  EventSchema.findByIdAndDelete(eventId, (err, ret) => {
    if (err) {
      console.error('[SERVER] Failed to save the events', err);
      res.send({
        error: 'Failed to save the event'
      });
    } else {
      res.send({
        result: ret
      });
    }
  });
});

module.exports = router;