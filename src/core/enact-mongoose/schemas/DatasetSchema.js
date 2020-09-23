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
const datasetSchema = new Schema({
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
  },
  lastModified: {
    type: Number,
    required: true
  },
  source: {
    type: String,
    enum: ['RECORDED', 'GENERATED', 'MUTATED'],
    required: true
  }
});

datasetSchema.statics.findDatasetsWithPagingOptions = function (options, page, callback) {
  this.find(options)
    .limit(20)
    .skip(page * 20)
    .sort({
      lastModified: 1
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

datasetSchema.statics.findDatasetsWithOptions = function (options, callback) {
  this.find(options)
    .sort({
      lastModified: 1
    })
    .exec((err, data) => {
      if (err) {
        return callback(err);
      }

      if (!data) {
        return callback({
          error: `Cannot find any recorded data`
        });
      }

      return callback(null, data);
    });
};

module.exports = mongoose.model("Dataset", datasetSchema);