// Route-level integration tests for the reports router (issue #92).
//
// Drives a real Express app mounting the reports router and asserts status
// codes, error shapes, and validation envelopes. No live MongoDB: the
// ENACTDB.prototype.connect is stubbed at the prototype seam so that any
// connection attempt fails immediately, while the validation layer and the
// route pipeline run for real.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { request } = require('./_http');

const dbcPath = require.resolve('../src/server/routes/db-connector');
const reportsPath = require.resolve('../src/server/routes/reports');
const enactPath = require.resolve('../src/core/enact-mongoose');

let server;
let connectRestore;

before(() => {
  // Stub ENACTDB.prototype.connect so any connection attempt fails immediately.
  const enact = require(enactPath);
  const original = enact.ENACTDB.prototype.connect;
  connectRestore = () => {
    enact.ENACTDB.prototype.connect = original;
  };
  enact.ENACTDB.prototype.connect = function (callback) {
    callback(new Error('connect ECONNREFUSED (stub)'));
  };

  // Clear module cache so dbConnector picks up the stub.
  delete require.cache[dbcPath];
  delete require.cache[reportsPath];

  const app = express();
  app.use(express.json());
  app.use('/api/reports', require(reportsPath));
  server = app.listen(0);
});

after(() => {
  if (connectRestore) connectRestore();
  if (server) server.close();
});

test('GET /api/reports returns 503 when the database is unavailable', async () => {
  const res = await request(server, 'GET', '/api/reports');
  assert.equal(res.status, 503, `GET /api/reports must return 503 without DB (${res.raw})`);
  assert.ok(res.body && res.body.error, 'an error body must be present');
});

test('GET /api/reports/:reportId returns 503 when the database is unavailable', async () => {
  const res = await request(server, 'GET', '/api/reports/507f1f77bcf86cd799439011');
  assert.equal(res.status, 503, `GET /:id must return 503 without DB (${res.raw})`);
});

test('POST /api/reports/:reportId returns 503 when the database is unavailable', async () => {
  const body = {
    report: {
      id: 'report-01',
      testCampaignId: 'campaign-01',
      originalDatasetId: 'ds-original',
      newDatasetId: 'ds-new',
      topologyFileName: 'model.json',
      createdAt: Date.now(),
      startTime: Date.now() - 60000,
      endTime: Date.now(),
      score: -1,
    },
    newScore: false,
  };
  const res = await request(server, 'POST', '/api/reports/507f1f77bcf86cd799439011', body);
  assert.equal(res.status, 503, `POST /:id must return 503 without DB (${res.raw})`);
});

test('DELETE /api/reports/:reportId returns 503 when the database is unavailable', async () => {
  const res = await request(server, 'DELETE', '/api/reports/507f1f77bcf86cd799439011');
  assert.equal(res.status, 503, `DELETE /:id must return 503 without DB (${res.raw})`);
});

test('pagination params default correctly and are accepted', async () => {
  // With no pagination params, the defaults (limit=50, skip=0) apply.
  const res = await request(server, 'GET', '/api/reports');
  assert.equal(res.status, 503, `no params must not be rejected (${res.raw})`);

  // With explicit pagination within bounds.
  const res2 = await request(server, 'GET', '/api/reports?limit=10&skip=20');
  assert.equal(res2.status, 503, `valid pagination must not be rejected (${res2.raw})`);
});

test('pagination rejects limit=0 and negative values', async () => {
  const res = await request(server, 'GET', '/api/reports?limit=0');
  assert.equal(res.status, 400, `limit=0 must be rejected (${res.raw})`);
});

test('pagination rejects limit above the maximum', async () => {
  const res = await request(server, 'GET', '/api/reports?limit=501');
  assert.equal(res.status, 400, `limit=501 must be rejected (${res.raw})`);
});

test('pagination rejects negative skip', async () => {
  const res = await request(server, 'GET', '/api/reports?skip=-1');
  assert.equal(res.status, 400, `skip=-1 must be rejected (${res.raw})`);
});

test('filter params topologyFileName and testCampaignId are accepted', async () => {
  const res = await request(
    server,
    'GET',
    '/api/reports?topologyFileName=model.json&testCampaignId=campaign-01'
  );
  assert.equal(res.status, 503, `valid filter params must not be rejected (${res.raw})`);
});

test('a report update body without newScore is accepted by validation', async () => {
  const body = {
    report: {
      id: 'report-01',
      testCampaignId: 'campaign-01',
      originalDatasetId: 'ds-original',
      newDatasetId: 'ds-new',
      topologyFileName: 'model.json',
      createdAt: Date.now(),
      startTime: Date.now() - 60000,
      endTime: Date.now(),
      score: 0.85,
    },
  };
  const res = await request(server, 'POST', '/api/reports/507f1f77bcf86cd799439011', body);
  assert.equal(res.status, 503, `update without newScore must pass validation (${res.raw})`);
});

test('a report update body with newScore=true is accepted by validation', async () => {
  const body = {
    report: {
      id: 'report-01',
      testCampaignId: 'campaign-01',
      originalDatasetId: 'ds-original',
      newDatasetId: 'ds-new',
      topologyFileName: 'model.json',
      createdAt: Date.now(),
      startTime: Date.now() - 60000,
      endTime: Date.now(),
      score: 0.85,
    },
    newScore: true,
  };
  const res = await request(server, 'POST', '/api/reports/507f1f77bcf86cd799439011', body);
  assert.equal(res.status, 503, `update with newScore=true must pass validation (${res.raw})`);
});

test('a report update body missing both report and newScore is rejected', async () => {
  const body = { otherField: 'not-valid' };
  const res = await request(server, 'POST', '/api/reports/507f1f77bcf86cd799439011', body);
  assert.equal(res.status, 400, `missing both report and newScore must be rejected (${res.raw})`);
});

test('a report with null optional fields is accepted by validation', async () => {
  const body = {
    report: {
      id: 'report-01',
      testCampaignId: null,
      originalDatasetId: null,
      newDatasetId: null,
      topologyFileName: null,
      createdAt: Date.now(),
      startTime: Date.now() - 60000,
      endTime: Date.now(),
      score: 0.5,
      evaluationParameters: null,
    },
  };
  const res = await request(server, 'POST', '/api/reports/507f1f77bcf86cd799439011', body);
  assert.equal(res.status, 503, `null optional fields must pass validation (${res.raw})`);
});

test('error response carries only error and details keys', async () => {
  // An invalid body for reports is rejected by validation.
  const body = { event: { invalid: 'body' } };
  const res = await request(server, 'POST', '/api/reports/507f1f77bcf86cd799439011', body);
  assert.equal(res.status, 400, `invalid body must be rejected (${res.raw})`);
  assert.ok(res.body && res.body.error, 'error must be a string');
  const keys = Object.keys(res.body).filter((k) => k !== 'error' && k !== 'details');
  assert.equal(keys.length, 0, `error body must carry no extra keys: ${res.raw}`);
});

test('a valid report body with all required fields passes validation', async () => {
  const body = {
    report: {
      id: 'report-01',
      testCampaignId: 'campaign-01',
      originalDatasetId: 'ds-original',
      newDatasetId: 'ds-new',
      topologyFileName: 'model.json',
      createdAt: Date.now(),
      startTime: Date.now() - 60000,
      endTime: Date.now(),
      score: 0.75,
    },
  };
  const res = await request(server, 'POST', '/api/reports/507f1f77bcf86cd799439011', body);
  assert.equal(res.status, 503, `a complete report body must pass validation (${res.raw})`);
});

test('the list endpoint accepts empty query params', async () => {
  const res = await request(server, 'GET', '/api/reports?');
  assert.equal(res.status, 503, `empty query must not be rejected (${res.raw})`);
});

test('the list endpoint accepts topologyFileName filter', async () => {
  const res = await request(server, 'GET', '/api/reports?topologyFileName=my-model.json');
  assert.equal(res.status, 503, `topologyFileName filter must be accepted (${res.raw})`);
});

test('the list endpoint accepts testCampaignId filter', async () => {
  const res = await request(server, 'GET', '/api/reports?testCampaignId=campaign-42');
  assert.equal(res.status, 503, `testCampaignId filter must be accepted (${res.raw})`);
});
