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

const mongoose = require("mongoose");

const Schema = mongoose.Schema;

const eventSchema = new Schema({
  datasetId: {
    type: String,
    required: true
  },
  timestamp: {
    type: Number,
    required: true
  },
  values: {
    type: Object,
    required: true
  },
  isSensorData: {
    type: Boolean,
    required: true
  },
  topic: {
    type: String,
    required: false
  }
});

eventSchema.statics.findEventsWithPagingOptions = function (options, page, callback) {
  this.find(options)
    .limit(200)
    .skip(page * 200)
    .sort({
      timestamp: 1
    })
    .exec((err, data) => {
      if (err) {
        return callback(err);
      }

      if (!data) {
        return callback({
          error: `Cannot find any event data`
        });
      }

      return callback(null, data);
    });
};

eventSchema.statics.findEventsWithOptions = function (options, callback) {
  this.find(options)
    .sort({
      timestamp: 1
    })
    .exec((err, data) => {
      if (err) {
        return callback(err);
      }

      if (!data) {
        return callback({
          error: `Cannot find any event data`
        });
      }

      return callback(null, data);
    });
};

eventSchema.statics.findEventsBetweenTimes = function (
  filter,
  startTime,
  endTime,
  callback
) {

  const options = {...filter,
    $and: [{
        timestamp: {
          $gte: Number(startTime)
        }
      },
      {
        timestamp: {
          $lte: Number(endTime)
        }
      }
    ]
  };
  // console.log(JSON.stringify(filter));
  return this.findEventsWithOptions(options, callback);
};

module.exports = mongoose.model("Event", eventSchema);