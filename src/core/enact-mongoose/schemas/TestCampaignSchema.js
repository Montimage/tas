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

const testCampaignSchema = new Schema({
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
  isDefault: {
    type: Boolean,
    required: false
  },
  testCaseIds: {
    type: Array,
    required: false
  },
  model: {
    type: String,
    require: true
  },
  webhookURL: {
    type: String,
    require: false
  }
});

testCampaignSchema.statics.findTestCampaignWithOptions = function (options, callback) {
  this.find(options)
    .exec((err, data) => {
      if (err) {
        return callback(err);
      }

      if (!data) {
        return callback({
          error: `Cannot find any TestCampaign data`
        });
      }

      return callback(null, data);
    });
};

module.exports = mongoose.model("TestCampaign", testCampaignSchema);