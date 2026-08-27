/**
 * Request correlation (issue #47).
 *
 * Every request carries a correlation identifier: an incoming trusted
 * `X-Request-Id` is honoured, anything else gets a fresh UUID, the id is
 * echoed in the `X-Request-Id` response header, and both the access record
 * and any failure record the server writes carry it - so all of one request's
 * lines can be pulled out of the log with a single filter, and credentials or
 * control characters cannot be smuggled into the log through a caller's own
 * header value.
 */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const express = require('express');

const { requestContext, SAFE_REQUEST_ID } = require('../src/server/middleware/request-context');
const { errorHandler, badRequest } = require('../src/server/middleware/errors');

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** The server log every record of this module lands in. */
const serverLogPath = path.join(__dirname, '..', 'src', 'server', 'logs', 'server.log');

/** Poll the server log until a line satisfies `predicate`. */
const waitForLine = (predicate, timeout = 3000) =>
  new Promise((resolve, reject) => {
    const started = Date.now();
    const tick = () => {
      let content = '';
      try {
        content = fs.readFileSync(serverLogPath, 'utf8');
      } catch (_) {
        /* not written yet */
      }
      const hit = content.split('\n').find(predicate);
      if (hit) return resolve(hit);
      if (Date.now() - started > timeout) {
        return reject(new Error('server log never received the expected line'));
      }
      setTimeout(tick, 50);
    };
    tick();
  });

describe('request ids', () => {
  test('every request gets a UUID echoed in X-Request-Id', async () => {
    const app = express();
    app.use(requestContext({ accessLog: false }));
    app.get('/ping', (req, res) => res.send({ requestId: req.requestId }));
    const server = app.listen(0);
    try {
      const res = await fetch(`http://127.0.0.1:${server.address().port}/ping`);
      assert.equal(res.status, 200);
      const echoed = res.headers.get('x-request-id');
      assert.ok(UUID_PATTERN.test(echoed), `the header must carry a UUID: ${echoed}`);
      const body = await res.json();
      assert.equal(body.requestId, echoed, 'the handler sees the same id');
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  test('a well-formed incoming X-Request-Id is honoured', async () => {
    const app = express();
    app.use(requestContext({ accessLog: false }));
    app.get('/ping', (req, res) => res.send({ requestId: req.requestId }));
    const server = app.listen(0);
    try {
      const res = await fetch(`http://127.0.0.1:${server.address().port}/ping`, {
        headers: { 'X-Request-Id': 'caller-trace.42_a' },
      });
      assert.equal(res.headers.get('x-request-id'), 'caller-trace.42_a');
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  test('an unsafe incoming id is discarded for a fresh UUID', async () => {
    assert.deepEqual(
      ['with space', 'semi;colon', '<script>', 'x'.repeat(65), ''].filter((value) =>
        SAFE_REQUEST_ID.test(value.trim())
      ),
      [],
      'none of these may pass the safety screen'
    );
    const app = express();
    app.use(requestContext({ accessLog: false }));
    app.get('/ping', (req, res) => res.send({ requestId: req.requestId }));
    const server = app.listen(0);
    try {
      const res = await fetch(`http://127.0.0.1:${server.address().port}/ping`, {
        headers: { 'X-Request-Id': '<script>alert(1)</script>' },
      });
      const echoed = res.headers.get('x-request-id');
      assert.ok(UUID_PATTERN.test(echoed), 'an unsafe id must be replaced by a UUID');
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });
});

describe('correlated records', () => {
  test('the access record carries the request id, status and duration', async () => {
    const app = express();
    app.use(requestContext());
    app.get('/access-check', (req, res) => res.send('ok'));
    const server = app.listen(0);
    const requestId = `access-${Date.now()}`;
    try {
      const res = await fetch(`http://127.0.0.1:${server.address().port}/access-check`, {
        headers: { 'X-Request-Id': requestId },
      });
      assert.equal(res.status, 200);
      const line = await waitForLine(
        (candidate) => candidate.includes('/access-check') && candidate.includes(requestId)
      );
      const record = JSON.parse(line);
      assert.equal(record.requestId, requestId);
      assert.equal(record.method, 'GET');
      assert.equal(record.path, '/access-check');
      assert.equal(record.status, 200);
      assert.equal(typeof record.durationMs, 'number');
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  test('a failure reported through the central handler carries the same id', async () => {
    const app = express();
    app.use(requestContext());
    app.get('/fails', (req, res, next) => next(badRequest('Correlation probe failure')));
    app.use(errorHandler);
    const server = app.listen(0);
    const requestId = `failure-${Date.now()}`;
    try {
      const res = await fetch(`http://127.0.0.1:${server.address().port}/fails`, {
        headers: { 'X-Request-Id': requestId },
      });
      assert.equal(res.status, 400);
      assert.equal(res.headers.get('x-request-id'), requestId);
      const line = await waitForLine(
        (candidate) =>
          candidate.includes(requestId) && candidate.includes('Correlation probe failure')
      );
      const record = JSON.parse(line);
      assert.equal(record.level, 'error');
      assert.match(record.message, /GET \/fails -> 400/);
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });
});
