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

const testCaseSchema = new Schema({
  id: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: false
  },
  description: {
    type: String,
    required: false
  },
  tags: {
    type: Array,
    required: false
  },
  datasetIds: {
    type: Array,
    required: false
  },
  modelFileName: {
    type: String,
    require: true
  }
});

testCaseSchema.statics.findTestCaseWithOptions = function (options, callback) {
  this.find(options)
    .exec((err, data) => {
      if (err) {
        return callback(err);
      }

      if (!data) {
        return callback({
          error: `Cannot find any TestCase data`
        });
      }

      return callback(null, data);
    });
};

module.exports = mongoose.model("TestCase", testCaseSchema);