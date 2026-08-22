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

const testCampaignSchema = new Schema({
  id: {
    type: String,
    required: true,
  },
  name: {
    type: String,
    required: false,
  },
  description: {
    type: String,
    required: false,
  },
  testCaseIds: {
    type: Array,
    required: false,
  },
  webhookURL: {
    type: String,
    require: false,
  },
});

testCampaignSchema.statics.findTestCampaignWithOptions = async function (options) {
  const data = await this.find(options).exec();

  if (!data) {
    throw {
      error: `Cannot find any TestCampaign data`,
    };
  }

  return data;
};

module.exports = mongoose.model('TestCampaign', testCampaignSchema);
