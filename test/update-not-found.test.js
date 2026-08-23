// Updating a database-backed resource that does not exist answers 404
// (issue #62).
//
// Issue #11 routed the API onto conventional status codes through one central
// handler, but its not-found guard for update routes landed on reports.js
// alone. The other four update handlers kept answering 200 with a null
// document, so a client could not tell a successful update from an update of
// a record that was never there.
//
// No live MongoDB: the schemas are stubbed at the boundary where the routes
// meet them - the same seam test/reports-pagination.test.js uses - returning
// exactly what Mongoose returns for a missing document (null). The full route
// pipeline runs for real: validation, dbConnector, handler, and the shared
// error handler that renders the response.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { request } = require('./_http');

// The routers captured their bindings from this module when they were first
// required, so the stubs must be in place before they load. Replacing the
// properties on the cached exports object is what puts them there - each
// router destructures these names off this very object as it loads.
const connectorPath = require.resolve('../src/server/routes/db-connector');

/** One stub model per resource; `nextResult` is what every lookup returns. */
let nextResult;
const stubModel = () => ({
  findOneAndUpdate: async () => nextResult,
  findByIdAndUpdate: async () => nextResult,
});

const connector = require(connectorPath);
connector.dbConnector = (req, res, next) => next();
connector.TestCampaignSchema = stubModel();
connector.TestCaseSchema = stubModel();
connector.DatasetSchema = stubModel();
connector.EventSchema = stubModel();

const testCampaignRouter = require('../src/server/routes/test-campaigns');
const testCasesRouter = require('../src/server/routes/test-cases');
const dataSetRouter = require('../src/server/routes/data-sets');
const eventRouter = require('../src/server/routes/events');

let server;

before(() => {
  const app = express();
  app.use(express.json());
  app.use('/api/test-campaigns', testCampaignRouter);
  app.use('/api/test-cases', testCasesRouter);
  app.use('/api/data-sets', dataSetRouter);
  app.use('/api/events', eventRouter);
  server = app.listen(0);
});

// The listening socket is a live handle: without this the suite's process
// outlives its tests and the runner waits for it forever.
after(() => {
  server.close();
});

/**
 * Assert a failure response is exactly what the central handler renders:
 * its status, one string message, and nothing besides `error`/`details`.
 */
const assertErrorShape = (res, status, context) => {
  assert.equal(res.status, status, `expected ${status} for ${context}, got ${res.status}`);
  assert.ok(res.body, `${context} must answer with a JSON body (${res.raw})`);
  assert.equal(typeof res.body.error, 'string', `${context} must carry a string error`);
  assert.ok(res.body.error.length > 0, `${context} must name the failure (${res.raw})`);
  assert.deepEqual(
    Object.keys(res.body).filter((key) => key !== 'error' && key !== 'details'),
    [],
    `an error body carries nothing but error and details: ${res.raw}`
  );
};

// The four updates the issue names, each driven against a missing document.
const cases = [
  [
    'test campaign',
    ['POST', '/api/test-campaigns/no-such-test-campaign', { testCampaign: { name: 'x' } }],
    'Test campaign not found',
  ],
  [
    'test case',
    ['POST', '/api/test-cases/no-such-test-case', { testCase: { name: 'x' } }],
    'Test case not found',
  ],
  [
    'data set',
    ['POST', '/api/data-sets/no-such-data-set', { dataset: { name: 'x' } }],
    'Data set not found',
  ],
  ['event', ['POST', '/api/events/no-such-event', { event: {} }], 'Event not found'],
];

for (const [resource, [method, routePath, body], message] of cases) {
  test(`updating a non-existent ${resource} returns a JSON 404`, async () => {
    nextResult = null; // Mongoose returns null when nothing matched.
    const res = await request(server, method, routePath, body);
    assertErrorShape(res, 404, `${method} ${routePath} against a missing document`);
    assert.equal(res.body.error, message);
  });
}

test('an update that does match a document is still served with the document', async () => {
  // The guard exists to catch a missing document, not to refuse updates:
  // with a document found, all four routes keep their historical shape.
  const stored = { _id: '64b64b64b64b64b64b64b64b', id: 'stored-1', name: 'stored' };
  nextResult = stored;
  for (const [, [method, routePath, body]] of cases) {
    const res = await request(server, method, routePath, body);
    assert.equal(res.status, 200, `a matching update must be served (${res.raw})`);
    assert.equal(res.body.error, undefined, `a served update carries no error (${res.raw})`);
  }
});
