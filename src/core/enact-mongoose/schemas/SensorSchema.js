/**
 * {
    "sensorID": "sensor-01",
    "timestamp": 1555510437786,
    "value": 1232,
  }
 */

const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const sensorSchema = new Schema({
  instanceId: {
    type: String,
    required: true,
  },
  objectId: {
    type: String,
    required: false,
  },
  timestamp: {
    type: Number,
    required: true,
  },
  values: {
    type: Object,
    required: true,
  },
  userData: {
    type: Object,
    required: false,
  },
});

sensorSchema.statics.findSensorsWithOptions = async function (options) {
  const stats = await this.find(options).sort({ timestamp: 1 }).exec();

  if (!stats) {
    throw { error: `Cannot find sensors` };
  }

  return stats;
};

sensorSchema.statics.findSensorDataBetweenTimes = function (filter, startTime, endTime) {
  const options = {
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

  if (filter) {
    options['$and'].push(filter);
  }
  return this.findSensorsWithOptions(options);
};

module.exports = mongoose.model('Sensor', sensorSchema);
