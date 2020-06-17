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

const recordedDataSchema = new Schema(
  {
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
    isUpStream: {
      type: Boolean,
      required: true
    },
    topic: {
      type: String,
      required: false
    }
  }
);

recordedDataSchema.statics.findRecordedDataWithOptions = function(options, callback) {
  this.find(options)
    .sort({ timestamp: 1 })
    .exec((err, data) => {
      if (err) {
        return callback(err);
      }

      if (!data) {
        return callback({ error: `Cannot find any recorded data` });
      }

      return callback(null, data);
    });
};

recordedDataSchema.statics.findRecordedDataBetweenTimes = function(
  filter,
  startTime,
  endTime,
  callback
) {

  const options = {
    $and: [
      {
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

  if (filter) {
    options['$and'].push(filter);
  }
  return this.findRecordedDataWithOptions(options, callback);
};

module.exports = mongoose.model("RecordedData", recordedDataSchema);
