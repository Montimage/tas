/**
 * - id
- createdAt
- modelFileName
- originalDatasetId
- newDatasetId
- startTime
- endTime
- score: Number
- testCampaignId: can be null

 */

const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const reportSchema = new Schema({
  id: {
    type: String,
    required: true,
  },
  testCampaignId: {
    type: String,
  },
  originalDatasetId: {
    type: String,
  },
  newDatasetId: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Number,
    required: true,
  },
  startTime: {
    type: Number,
    required: true,
  },
  endTime: {
    type: Number,
    required: true,
  },
  score: {
    type: Number,
    required: true,
  },
  topologyFileName: {
    type: String,
    required: false,
  },
  evaluationParameters: {
    type: Object,
  },
});
reportSchema.statics.findReportsWithOptions = async function (options) {
  const data = await this.find(options)
    .sort({
      createdAt: 1,
    })
    .exec();

  if (!data) {
    throw {
      error: `Cannot find any Report data`,
    };
  }

  return data;
};

module.exports = mongoose.model('Report', reportSchema);
