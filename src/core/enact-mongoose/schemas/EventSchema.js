/**
 * {
    {
      "timestamp": 1591971273868,
      "topic": "enact/sensors/temp-03",
      "datasetId": "new-data-set",
      "isUpstream": true,
      "values": {}
    }

  }
 */

const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const eventSchema = new Schema({
  datasetId: {
    type: String,
    required: true,
  },
  timestamp: {
    type: Number,
    required: true,
  },
  values: {
    type: Object,
    required: true,
  },
  isSensorData: {
    type: Boolean,
    required: true,
  },
  topic: {
    type: String,
    required: false,
  },
});

eventSchema.statics.findEventsWithPagingOptions = async function (options, page) {
  const data = await this.find(options)
    .limit(200)
    .skip(page * 200)
    .sort({
      timestamp: 1,
    })
    .exec();

  if (!data) {
    throw {
      error: `Cannot find any event data`,
    };
  }

  return data;
};

// Bounded result sets (issue #31): the scoring path passes a `limit` so a
// large run cannot pull its whole event stream into memory to be scored.
eventSchema.statics.findEventsWithOptions = async function (options, limit = null) {
  let query = this.find(options).sort({
    timestamp: 1,
  });
  if (Number.isInteger(limit)) {
    query = query.limit(limit);
  }
  const data = await query.exec();

  if (!data) {
    throw {
      error: `Cannot find any event data`,
    };
  }

  return data;
};

eventSchema.statics.findEventsBetweenTimes = function (filter, startTime, endTime, limit = null) {
  const options = {
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
  // console.log(JSON.stringify(filter));
  return this.findEventsWithOptions(options, limit);
};

module.exports = mongoose.model('Event', eventSchema);
