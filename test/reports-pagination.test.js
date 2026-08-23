// Paginated report list and bounded scoring reads
// (issue #85 / F-PERF-004 + issue #31 bounded result sets).
//
// The list endpoint's pagination is wired through `findReportsWithOptions`,
// so these tests stub the mongoose query chain at the model boundary - the
// same pattern as test/data-storage.test.js and
// test/db-connector-credential-redaction.test.js. No live MongoDB: what is
// pinned is the contract the route and schema share (page plumbing, additive
// response fields, default page size) plus the validation envelope around it.
const { test } = require('node:test');
const assert = require('node:assert/strict');

const ReportSchema = require('../src/core/enact-mongoose/schemas/ReportSchema');
const EventSchema = require('../src/core/enact-mongoose/schemas/EventSchema');

// A query chain fake that records every paging call and resolves to docs.
const makeChain = (docs) => {
  const calls = { skip: [], limit: [], sort: null };
  const chain = {
    calls,
    sort(sortSpec) {
      calls.sort = sortSpec;
      return chain;
    },
    skip(n) {
      calls.skip.push(n);
      return chain;
    },
    limit(n) {
      calls.limit.push(n);
      return chain;
    },
    async exec() {
      return docs;
    },
  };
  return chain;
};

test('findReportsWithOptions pages only when the caller declares a page', async () => {
  const docs = [{ id: 'r1' }, { id: 'r2' }];
  const originalFind = ReportSchema.find;

  // No paging argument: unbounded, exactly the historical shape.
  let chain = makeChain(docs);
  ReportSchema.find = () => chain;
  try {
    const all = await ReportSchema.findReportsWithOptions({ topologyFileName: 't.json' });
    assert.deepEqual(all, docs);
    assert.deepEqual(chain.calls.skip, [], 'no skip may be applied without paging');
    assert.deepEqual(chain.calls.limit, [], 'no limit may be applied without paging');
    assert.deepEqual(chain.calls.sort, { createdAt: 1 });

    // With paging: both bounds reach the query, skip 0 still applies nothing.
    chain = makeChain(docs);
    const page = await ReportSchema.findReportsWithOptions({}, { limit: 50, skip: 100 });
    assert.deepEqual(page, docs);
    assert.deepEqual(chain.calls.skip, [100]);
    assert.deepEqual(chain.calls.limit, [50]);

    chain = makeChain(docs);
    await ReportSchema.findReportsWithOptions({}, { limit: 25, skip: 0 });
    assert.deepEqual(chain.calls.skip, [], 'skip 0 needs no skip call');
    assert.deepEqual(chain.calls.limit, [25]);
  } finally {
    ReportSchema.find = originalFind;
  }
});

// Run a route's validation layer on its own, with no handler and no database
// behind it - the same seam input-validation.test.js uses for routes that
// cannot reach their database in tests.
const routesOf = (router) =>
  router.stack
    .filter((layer) => layer.route)
    .map((layer) => ({
      path: layer.route.path,
      method: Object.keys(layer.route.methods).join(',').toUpperCase(),
      handles: layer.route.stack.map((entry) => entry.handle),
    }));

const validateOnly = (router, method, routePath, req) => {
  const route = routesOf(router).find(
    (candidate) => candidate.path === routePath && candidate.method === method
  );
  assert.ok(route, `no ${method} ${routePath} route`);
  const layer = route.handles.find((handle) => handle.name === 'validateRequest');
  assert.ok(layer, `${method} ${routePath} declares no schema`);
  return new Promise((resolve) => {
    const res = {
      statusCode: 200,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(payload) {
        resolve({ passed: false, status: this.statusCode, body: payload });
      },
    };
    const request_ = { params: {}, query: {}, body: {}, ...req };
    layer(request_, res, (err) => {
      if (!err) return resolve({ passed: true, req: request_ });
      const realConsoleError = console.error;
      console.error = () => {};
      try {
        return resolve({ passed: false, status: err.status || 500, body: err });
      } finally {
        console.error = realConsoleError;
      }
    });
  });
};

test('the route accepts declared pagination params and rejects hostile ones', async () => {
  const reportRouter = require('../src/server/routes/reports');

  for (const query of [
    {},
    { limit: '1' },
    { limit: '500', skip: '0' },
    { topologyFileName: 'topology.json', limit: '37', skip: '74' },
  ]) {
    const passed = await validateOnly(reportRouter, 'GET', '/', { query });
    assert.equal(
      passed.passed,
      true,
      `query ${JSON.stringify(query)} must be accepted (${JSON.stringify(passed.body)})`
    );
    assert.equal(passed.req.query.limit, Number(query.limit || 50), 'limit converts and defaults');
    assert.equal(passed.req.query.skip, Number(query.skip || 0), 'skip converts and defaults');
  }

  for (const query of [
    { limit: '0' },
    { limit: '501' },
    { limit: '-5' },
    { skip: '-1' },
    { limit: '10.5' },
    { limit: { $gt: 0 } },
    { skip: { $ne: 0 } },
  ]) {
    const passed = await validateOnly(reportRouter, 'GET', '/', { query });
    assert.equal(passed.passed, false, `query ${JSON.stringify(query)} must be refused`);
  }
});

test('event statics thread an optional scoring bound into their queries', async () => {
  const originalFind = EventSchema.find;
  const docs = [];
  let chain = makeChain(docs);
  EventSchema.find = () => chain;
  try {
    // findEventsWithOptions without a limit stays unbounded.
    await EventSchema.findEventsWithOptions({ datasetId: 'd1' });
    assert.deepEqual(chain.calls.limit, []);

    // ...and with one, the bound reaches the query in time order.
    chain = makeChain(docs);
    await EventSchema.findEventsWithOptions({ datasetId: 'd1' }, 10000);
    assert.deepEqual(chain.calls.limit, [10000]);
    assert.deepEqual(chain.calls.sort, { timestamp: 1 });

    // findEventsBetweenTimes forwards the window filter and the bound.
    chain = makeChain(docs);
    await EventSchema.findEventsBetweenTimes({ datasetId: 'd2' }, 5, 10, 999);
    assert.deepEqual(chain.calls.limit, [999]);
  } finally {
    EventSchema.find = originalFind;
  }
});
