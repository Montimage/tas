// Bounded log reads (issue #85 / F-PERF-003).
//
// GET /api/logs/*/:fileName used to buffer the whole file into a JSON
// envelope with no cap. It now answers with the last LOG_READ_MAX_BYTES
// bytes in that same envelope (plus additive metadata), and streams any
// single-interval `bytes=` range straight to the socket as 206 text/plain.
// These tests pin both shapes, the 416 contract, and the untouched
// error/traversal behavior, using a throwaway file under the real
// simulations log directory (gitignored) exactly like http-status.test.js.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const { request } = require('./_http');

const createLogRouter = require('../src/server/routes/logs');

const simulationLogsDir = path.resolve(__dirname, '../src/server/logs/simulations');

let server;
let app;
let smallLogFile;
let bigLogFile;
const BIG_SIZE = createLogRouter.LOG_READ_MAX_BYTES + 4096;

before(() => {
  fs.mkdirSync(simulationLogsDir, { recursive: true });
  const unique = `${Date.now()}-bounds`;
  smallLogFile = path.join(simulationLogsDir, `${unique}-small.log`);
  bigLogFile = path.join(simulationLogsDir, `${unique}-big.log`);
  fs.writeFileSync(smallLogFile, 'a line the server wrote\nsecond line\n');
  // Deterministic content: byte i is printable, so range slices are verifiable.
  const big = Buffer.alloc(BIG_SIZE);
  for (let i = 0; i < BIG_SIZE; i++) big[i] = 32 + (i % 95);
  fs.writeFileSync(bigLogFile, big);

  app = express();
  app.use('/api/logs/simulations', createLogRouter('simulations'));
  server = app.listen(0);
});

after(() => {
  server.close();
  fs.rmSync(smallLogFile, { force: true });
  fs.rmSync(bigLogFile, { force: true });
});

test('a log within the cap reads back whole with additive metadata', async () => {
  const res = await request(
    server,
    'GET',
    `/api/logs/simulations/${encodeURIComponent(path.basename(smallLogFile))}`
  );
  assert.equal(res.status, 200, res.raw);
  assert.equal(res.body.error, null);
  assert.match(res.body.content, /a line the server wrote/);
  assert.equal(res.body.truncated, false);
  assert.equal(res.body.totalSize, Buffer.byteLength('a line the server wrote\nsecond line\n'));
  assert.ok(Array.isArray(res.body.content.match(/\n/g)));
  assert.equal(res.headers['accept-ranges'], 'bytes');
});

test('a log larger than the cap returns only its tail, capped', async () => {
  const res = await request(
    server,
    'GET',
    `/api/logs/simulations/${encodeURIComponent(path.basename(bigLogFile))}`
  );
  assert.equal(res.status, 200, res.raw.slice(0, 200));
  assert.equal(res.body.error, null);
  assert.equal(res.body.truncated, true);
  assert.equal(res.body.totalSize, BIG_SIZE);
  const returned = Buffer.byteLength(res.body.content, 'utf8');
  assert.ok(
    returned <= createLogRouter.LOG_READ_MAX_BYTES,
    `the envelope must not exceed the cap (${returned})`
  );
  assert.ok(returned > createLogRouter.LOG_READ_MAX_BYTES - 200, 'the tail must be substantial');
});

test('a single-interval byte range streams as 206 text/plain', async () => {
  const res = await request(
    server,
    'GET',
    `/api/logs/simulations/${encodeURIComponent(path.basename(smallLogFile))}`,
    null,
    { Range: 'bytes=2-5' }
  );
  assert.equal(res.status, 206);
  assert.match(String(res.headers['content-type']), /text\/plain/);
  assert.match(res.headers['content-range'], /^bytes 2-5\//);
  assert.equal(res.raw, 'line');
});

test('a suffix range delivers the final N bytes', async () => {
  const res = await request(
    server,
    'GET',
    `/api/logs/simulations/${encodeURIComponent(path.basename(smallLogFile))}`,
    null,
    { Range: 'bytes=-5' }
  );
  assert.equal(res.status, 206);
  assert.match(res.headers['content-range'], /^bytes \d+-\d+\//);
  assert.equal(res.raw, 'line\n');
});

test('an oversized range is clamped to the hard cap', async () => {
  const res = await request(
    server,
    'GET',
    `/api/logs/simulations/${encodeURIComponent(path.basename(bigLogFile))}`,
    null,
    { Range: `bytes=0-${BIG_SIZE - 1}` }
  );
  assert.equal(res.status, 206);
  assert.match(
    res.headers['content-range'],
    new RegExp(`^bytes 0-${createLogRouter.LOG_READ_MAX_BYTES - 1}/`)
  );
});

test('a range beyond EOF answers 416 with the unsatisfied range', async () => {
  const res = await request(
    server,
    'GET',
    `/api/logs/simulations/${encodeURIComponent(path.basename(smallLogFile))}`,
    null,
    { Range: `bytes=${fs.statSync(smallLogFile).size + 10}-` }
  );
  assert.equal(res.status, 416);
  assert.match(res.headers['content-range'], /^bytes \*\//);
});

test('a malformed or foreign-unit range is ignored, not fatal', async () => {
  for (const range of ['chunks=1-2', 'bytes=not-a-range', 'bytes=5-2', 'bytes=1-2,4-5']) {
    const res = await request(
      server,
      'GET',
      `/api/logs/simulations/${encodeURIComponent(path.basename(smallLogFile))}`,
      null,
      { Range: range }
    );
    assert.equal(res.status, 200, `Range "${range}" must be ignored`);
    assert.ok(
      res.body && typeof res.body.content === 'string',
      `Range "${range}" serves the envelope`
    );
  }
});

test('reading and traversing logs keeps its documented failure contract', async () => {
  const missing = await request(
    server,
    'GET',
    `/api/logs/simulations/${encodeURIComponent(`absent_${Date.now()}.log`)}`
  );
  assert.equal(missing.status, 404);
  assert.equal(missing.body.error, 'Log file not found');

  const traversal = await request(server, 'GET', '/api/logs/simulations/..%2Fpackage.json');
  assert.equal(traversal.status, 400);
});
