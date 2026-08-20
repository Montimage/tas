var test = require('node:test');
var assert = require('node:assert');
var { startApp } = require('./helpers/start-app');

test('requests larger than the configured body limit are rejected with 413', async function () {
  var ctx = await startApp({ BODY_LIMIT: '1kb' });
  try {
    var big = JSON.stringify({ payload: 'x'.repeat(10 * 1024) });
    var res = await fetch(ctx.base + '/api/devops/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: big,
    });
    assert.strictEqual(res.status, 413);
    var body = await res.json();
    assert.ok(body.error);
  } finally {
    ctx.server.close();
    ctx.restore();
  }
});

test('the default body limit is no longer the previous 50mb', async function () {
  var { loadConfig } = require('../src/server/config');
  assert.notStrictEqual(loadConfig().bodyLimit, '50mb');
});

test('a small request under the limit is not rejected as too large', async function () {
  var ctx = await startApp({ BODY_LIMIT: '1kb' });
  try {
    var res = await fetch(ctx.baseUrl + '/api/devops/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ a: 1 }),
    });
    // The body is parsed fine; the route does not exist as POST, so it falls
    // through to the 404 handler rather than a 413.
    assert.notStrictEqual(res.status, 413);
  } finally {
    ctx.server.close();
    ctx.restore();
  }
});

test('the body limit can be raised via configuration', async function () {
  var ctx = await startApp({ BODY_LIMIT: '100mb' });
  try {
    var big = JSON.stringify({ payload: 'y'.repeat(2 * 1024 * 1024) });
    var res = await fetch(ctx.baseUrl + '/api/devops/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: big,
    });
    // 2MB < 100MB so it should be accepted by the parser (and then 404 as the
    // route is GET-only) - definitely not 413.
    assert.notStrictEqual(res.status, 413);
  } finally {
    ctx.server.close();
    ctx.restore();
  }
});
