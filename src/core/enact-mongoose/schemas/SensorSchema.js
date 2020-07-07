/**
 * {
    "sensorID": "sensor-01",
    "timestamp": 1555510437786,
    "value": 1232,
  }
 */

const mongoose = require("mongoose");

const Schema = mongoose.Schema;

const sensorSchema = new Schema(
  {
    instanceId: {
      type: String,
      required: true
    },
    objectId: {
      type: String,
      required: false
    },
    timestamp: {
      type: Number,
      required: true
    },
    values: {
      type: Object,
      required: true
    },
    userData: {
      type: Object,
      required: false
    }
  }
);

sensorSchema.statics.findSensorsWithOptions = function(options, callback) {
  this.find(options)
    .sort({ timestamp: 1 })
    .exec((err, stats) => {
      if (err) {
        return callback(err);
      }

      if (!stats) {
        return callback({ error: `Cannot find sensors` });
      }

      return callback(null, stats);
    });
};

sensorSchema.statics.findSensorDataBetweenTimes = function(
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
  return this.findSensorsWithOptions(options, callback);
};

module.exports = mongoose.model("Sensor", sensorSchema);