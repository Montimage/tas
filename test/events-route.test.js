// Route-level integration tests for the events router (issue #92).
//
// Drives a real Express app mounting the events router and asserts status
// codes, error shapes, and validation envelopes. No live MongoDB: the
// ENACTDB.prototype.connect is stubbed at the prototype seam so that any
// connection attempt fails immediately, while the validation layer and the
// route pipeline run for real.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { request } = require('./_http');

const dbcPath = require.resolve('../src/server/routes/db-connector');
const eventsPath = require.resolve('../src/server/routes/events');
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
  delete require.cache[eventsPath];

  const app = express();
  app.use(express.json());
  app.use('/api/events', require(eventsPath));
  server = app.listen(0);
});

after(() => {
  if (connectRestore) connectRestore();
  if (server) server.close();
});

test('GET /api/events returns 503 when the database is unavailable', async () => {
  const res = await request(server, 'GET', '/api/events');
  assert.equal(res.status, 503, `GET /api/events must return 503 without DB (${res.raw})`);
  assert.ok(res.body && res.body.error, 'an error body must be present');
  assert.ok(
    /database.*unavailable/i.test(res.body.error) || /unavailable/i.test(res.body.error),
    `the error must name the dependency failure: ${res.raw}`
  );
});

test('GET /api/events/:eventId returns 503 when the database is unavailable', async () => {
  const res = await request(server, 'GET', '/api/events/507f1f77bcf86cd799439011');
  assert.equal(res.status, 503, `GET /:id must return 503 without DB (${res.raw})`);
});

test('POST /api/events returns 503 when the database is unavailable', async () => {
  const body = {
    event: {
      timestamp: Date.now(),
      topic: 'test/topic',
      datasetId: 'test-ds-01',
      isSensorData: true,
      values: { value: 42 },
    },
  };
  const res = await request(server, 'POST', '/api/events', body);
  assert.equal(res.status, 503, `POST /api/events must return 503 without DB (${res.raw})`);
});

test('POST /api/events/:eventId returns 503 when the database is unavailable', async () => {
  const body = {
    event: {
      topic: 'test/topic-updated',
      values: { value: 99 },
    },
  };
  const res = await request(server, 'POST', '/api/events/507f1f77bcf86cd799439011', body);
  assert.equal(res.status, 503, `POST /:id must return 503 without DB (${res.raw})`);
});

test('DELETE /api/events/:eventId returns 503 when the database is unavailable', async () => {
  const res = await request(server, 'DELETE', '/api/events/507f1f77bcf86cd799439011');
  assert.equal(res.status, 503, `DELETE /:id must return 503 without DB (${res.raw})`);
});

test('malformed event body is rejected with 400 before reaching the database', async () => {
  // Missing required fields: timestamp, topic, datasetId, isSensorData, values
  const res = await request(server, 'POST', '/api/events', {
    event: { someField: 'not-allowed' },
  });
  assert.equal(res.status, 400, `missing required fields must return 400 (${res.raw})`);
  assert.ok(res.body && res.body.error, 'a 400 must carry an error message');
});

test('an event body with unknown keys reaches the handler (documentSchema allows them)', async () => {
  const body = {
    event: {
      timestamp: Date.now(),
      topic: 'test/topic',
      datasetId: 'test-ds-01',
      isSensorData: true,
      values: { value: 42 },
      extraField: 'this is allowed by documentSchema',
    },
  };
  const res = await request(server, 'POST', '/api/events', body);
  // documentSchema uses .unknown(true), so unknown keys pass validation
  // and the request reaches the dbConnector (503 here).
  assert.equal(res.status, 503, `unknown keys must pass validation (${res.raw})`);
});

test('GET /:eventId without ObjectId format reaches the dbConnector', async () => {
  // The GET /:eventId route has no param validation middleware — it goes
  // straight to dbConnector, so an invalid id reaches the handler.
  const res = await request(server, 'GET', '/api/events/not-an-object-id');
  assert.equal(res.status, 503, `invalid id reaches the dbConnector (${res.raw})`);
});

test('GET /api/events with query params passes validation', async () => {
  // The query params are validated but the handler never runs (no DB).
  // We assert that the request reaches the handler (503) rather than
  // being rejected for bad query params (400).
  const res = await request(server, 'GET', '/api/events?datasetId=test-ds&topic=test/topic');
  assert.equal(res.status, 503, `valid query params must not be rejected (${res.raw})`);
});

test('a valid event body is accepted by validation even without a database', async () => {
  const body = {
    event: {
      timestamp: Date.now(),
      topic: 'sensors/temp/01',
      datasetId: 'homeio-dataset-01',
      isSensorData: true,
      values: { temperature: 23.5 },
    },
  };
  const res = await request(server, 'POST', '/api/events', body);
  // Should reach the handler (503 from dbConnector stub), not be rejected by validation.
  assert.equal(res.status, 503, `a valid body must pass validation (${res.raw})`);
});

test('a boolean values field is accepted by the schema', async () => {
  const body = {
    event: {
      timestamp: Date.now(),
      topic: 'sensors/switch/01',
      datasetId: 'test-ds',
      isSensorData: true,
      values: true,
    },
  };
  const res = await request(server, 'POST', '/api/events', body);
  assert.equal(res.status, 503, `boolean values must pass validation (${res.raw})`);
});

test('a string values field is accepted by the schema', async () => {
  const body = {
    event: {
      timestamp: Date.now(),
      topic: 'sensors/status/01',
      datasetId: 'test-ds',
      isSensorData: true,
      values: 'ok',
    },
  };
  const res = await request(server, 'POST', '/api/events', body);
  assert.equal(res.status, 503, `string values must pass validation (${res.raw})`);
});

test('an array values field is accepted by the schema', async () => {
  const body = {
    event: {
      timestamp: Date.now(),
      topic: 'sensors/multi/01',
      datasetId: 'test-ds',
      isSensorData: true,
      values: [1, 2, 3],
    },
  };
  const res = await request(server, 'POST', '/api/events', body);
  assert.equal(res.status, 503, `array values must pass validation (${res.raw})`);
});

test('a numeric values field is accepted by the schema', async () => {
  const body = {
    event: {
      timestamp: Date.now(),
      topic: 'sensors/count/01',
      datasetId: 'test-ds',
      isSensorData: true,
      values: 42,
    },
  };
  const res = await request(server, 'POST', '/api/events', body);
  assert.equal(res.status, 503, `numeric values must pass validation (${res.raw})`);
});
