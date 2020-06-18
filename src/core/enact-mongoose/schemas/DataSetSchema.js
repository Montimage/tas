/**
 * - id: String
- name: String
- description: String
- tags: [String] # array of tags
- events: [Event]

 */

const mongoose = require("mongoose");

const Schema = mongoose.Schema;
/**
 * TODO: 
 * - get Dataset by name/id
 * - get dataset by tags
 */
const dataSetSchema = new Schema(
  {
    id: {
      type: String,
      required: true
    },
    name: {
      type: String,
      required: true
    },
    tags: {
      type: Array,
      required: true
    },
    description: {
      type: String,
      required: false
    },
    createdAt: {
      type: Number,
      required: true
    }
  }
);

dataSetSchema.statics.findDataSetWithOptions = function(options, callback) {
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

dataSetSchema.statics.findDataSetBetweenTimes = function(
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
  return this.findDataSetWithOptions(options, callback);
};

module.exports = mongoose.model("DataSet", dataSetSchema);
