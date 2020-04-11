/**
 * {
    "id": "actuator-01",
    "timestamp": 1555510437786,
    "value": 1232,
  }
 */

const mongoose = require("mongoose");

const Schema = mongoose.Schema;

const actuatorSchema = new Schema(
  {
    id: {
      type: String,
      required: true
    },
    timestamp: {
      type: Number,
      required: true
    },
    value: {
      type: Object,
      required: true
    }
  }
);

actuatorSchema.statics.findActuatorsWithOptions = function(options, callback) {
  this.find(options)
    .sort({ timestamp: 1 })
    .exec((err, stats) => {
      if (err) {
        return callback(err);
      }

      if (!stats) {
        return callback({ error: `Cannot find actuator` });
      }

      return callback(null, stats);
    });
};

actuatorSchema.statics.findActuatorDataBetweenTimes = function(
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
  return this.findActuatorsWithOptions(options, callback);
};

module.exports = mongoose.model("Actuator", actuatorSchema);
