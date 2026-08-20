/**
 * End-to-end resource-limits regression suite (issue #8).
 *
 * Starts dedicated real instances tuned for each limit and drives them over
 * HTTP. Proves oversized bodies are rejected (413) rather than buffered, and
 * burst traffic is rate-limited (429) rather than served.
 */
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer, request } = require('./helpers');

const servers = [];

after(async () => {
  await Promise.all(servers.map((s) => s.stop()));
});

test('oversized bodies are rejected (413) rather than served', async () => {
  const server = await startServer({ BODY_LIMIT: '1kb' });
  servers.push(server);

  const oversize = { name: 'big', devices: [], padding: 'x'.repeat(8 * 1024) };
  const res = await request(server.baseUrl, 'POST', '/api/models/', {
    body: oversize,
  });
  assert.equal(res.status, 413, 'oversized body must be rejected with 413');
  assert.equal(res.body.error, 'Request entity too large');

  // The instance must remain usable after a rejected oversized request.
  const alive = await request(server.baseUrl, 'GET', '/api/models/');
  assert.equal(alive.status, 200, 'server must remain alive after a 413');
});

test('burst traffic is rate-limited (429) rather than served', async () => {
  // One over the three requests asserted below: the helper's login (issue #9)
  // is itself an /api request and consumes a slot before the loop starts.
  const server = await startServer({
    RATE_LIMIT_MAX: '4',
    RATE_LIMIT_WINDOW_MS: String(60 * 1000),
  });
  servers.push(server);

  const statuses = [];
  for (let i = 0; i < 6; i += 1) {
    const res = await request(server.baseUrl, 'GET', '/api/models/');
    statuses.push(res.status);
  }
  // With a limit of 3, requests 1-3 are served; the burst past the limit is
  // rejected rather than served.
  assert.deepEqual(statuses.slice(0, 3), [200, 200, 200], 'first requests must be served');
  assert.deepEqual(statuses.slice(3), [429, 429, 429], 'burst traffic must be rejected');
});
