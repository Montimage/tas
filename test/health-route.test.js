// Route-level integration test for the /api/health liveness probe (issue #23,
// acceptance criteria 1 and 5: drive a real instance rather than calling
// handlers directly, and assert status code + response shape). /api/health is
// the only unauthenticated route (mounted at /api/health in app.js) and it
// performs no database work, so this exercises the real HTTP stack without
// needing a provisioned datastore.
const test = require('node:test');
const assert = require('node:assert/strict');
const { startApp } = require('./helpers/start-app');
const { request } = require('./_http');

test('GET /api/health answers 200 with a minimal status payload', async () => {
  const app = await startApp({ RATE_LIMIT_MAX: '100000' });
  try {
    const res = await request(app.server, 'GET', '/api/health', undefined, { __anonymous: true });
    assert.equal(res.status, 200);
    assert.ok(res.body && res.body.status === 'ok', `body was ${res.raw}`);
    // Issue #45: the endpoint reports readiness — true once startup has
    // completed (the helper mirrors the production listen callback).
    assert.equal(res.body.ready, true, `body was ${res.raw}`);
  } finally {
    await new Promise((resolve) => app.server.close(resolve));
    if (app.restore) app.restore();
  }
});

test('GET /api/health is reachable without credentials', async () => {
  const app = await startApp({ RATE_LIMIT_MAX: '100000' });
  try {
    // The helper normally attaches a session; __anonymous strips it so we assert
    // the endpoint is genuinely open to anonymous callers.
    const res = await request(app.server, 'GET', '/api/health', undefined, { __anonymous: true });
    assert.equal(res.status, 200);
  } finally {
    await new Promise((resolve) => app.server.close(resolve));
    if (app.restore) app.restore();
  }
});
