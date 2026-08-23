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
reportSchema.statics.findReportsWithOptions = async function (options, paging = null) {
  // Pagination (F-PERF-004, issue #85): the caller declares a page with
  // `{ limit, skip }`. Without `paging` the query stays unbounded, which only
  // the route-level default should ever rely on.
  let query = this.find(options).sort({
    createdAt: 1,
  });
  if (paging) {
    if (Number.isInteger(paging.skip) && paging.skip > 0) {
      query = query.skip(paging.skip);
    }
    if (Number.isInteger(paging.limit)) {
      query = query.limit(paging.limit);
    }
  }
  const data = await query.exec();

  if (!data) {
    throw {
      error: `Cannot find any Report data`,
    };
  }

  return data;
};

module.exports = mongoose.model('Report', reportSchema);
