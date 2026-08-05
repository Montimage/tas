var test = require('node:test');
var assert = require('node:assert');
var { startApp } = require('./helpers/start-app');

test.afterEach(function () {
  // Ensure no residual cross-origin config leaks into later tests.
});

test('same-origin and no-origin requests are served without CORS restrictions', async function () {
  var ctx = await startApp({});
  try {
    var res = await fetch(ctx.base + '/', { headers: { Origin: ctx.base } });
    assert.strictEqual(res.status, 200);
    assert.ok((await res.text()).toLowerCase().indexOf('<!doctype html>') !== -1);

    var noOrigin = await fetch(ctx.base + '/');
    assert.strictEqual(noOrigin.status, 200);
    assert.strictEqual(noOrigin.headers.get('Access-Control-Allow-Origin'), null);
  } finally {
    ctx.server.close();
    ctx.restore();
  }
});

test('cross-origin requests from unlisted origins are rejected with 403', async function () {
  var ctx = await startApp({});
  try {
    var res = await fetch(ctx.base + '/', {
      headers: { Origin: 'https://evil.example.com' }
    });
    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.headers.get('Access-Control-Allow-Origin'), null);
    var body = await res.json();
    assert.ok(body.error);
  } finally {
    ctx.server.close();
    ctx.restore();
  }
});

test('cross-origin mutating requests from unlisted origins are rejected with 403', async function () {
  var ctx = await startApp({});
  try {
    var res = await fetch(ctx.base + '/api/devops/status', {
      method: 'POST',
      headers: { 'Origin': 'https://evil.example.com', 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: 'x' })
    });
    assert.strictEqual(res.status, 403);
  } finally {
    ctx.server.close();
    ctx.restore();
  }
});

test('explicitly allowed origins receive CORS headers and pass', async function () {
  var ctx = await startApp({ CORS_ALLOWED_ORIGINS: 'https://ops.example.com' });
  try {
    var res = await fetch(ctx.base + '/api/devops/status', {
      headers: { Origin: 'https://ops.example.com' }
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.headers.get('Access-Control-Allow-Origin'), 'https://ops.example.com');
    assert.strictEqual(res.headers.get('Access-Control-Allow-Methods'), 'GET, POST, DELETE, OPTIONS');
    assert.strictEqual(res.headers.get('Access-Control-Allow-Headers'), 'Content-Type');
    assert.strictEqual(res.headers.get('Access-Control-Allow-Credentials'), 'true');
  } finally {
    ctx.server.close();
    ctx.restore();
  }
});

test('preflight OPTIONS for an allowed origin is answered without reaching routes', async function () {
  var ctx = await startApp({ CORS_ALLOWED_ORIGINS: 'https://ops.example.com' });
  try {
    var res = await fetch(ctx.base + '/api/models', {
      method: 'OPTIONS',
      headers: {
        'Origin': 'https://ops.example.com',
        'Access-Control-Request-Method': 'POST'
      }
    });
    assert.strictEqual(res.status, 204);
    assert.strictEqual(res.headers.get('Access-Control-Allow-Methods'), 'GET, POST, DELETE, OPTIONS');
  } finally {
    ctx.server.close();
    ctx.restore();
  }
});

test('preflight OPTIONS for an unlisted origin is rejected with 403', async function () {
  var ctx = await startApp({});
  try {
    var res = await fetch(ctx.base + '/api/models', {
      method: 'OPTIONS',
      headers: {
        'Origin': 'https://evil.example.com',
        'Access-Control-Request-Method': 'POST'
      }
    });
    assert.strictEqual(res.status, 403);
  } finally {
    ctx.server.close();
    ctx.restore();
  }
});

test('the wildcard origin is never emitted', async function () {
  var ctx = await startApp({ CORS_ALLOWED_ORIGINS: 'https://ops.example.com' });
  try {
    var res = await fetch(ctx.base + '/api/devops/status', {
      headers: { Origin: 'https://ops.example.com' }
    });
    assert.notStrictEqual(res.headers.get('Access-Control-Allow-Origin'), '*');
    assert.notStrictEqual(res.headers.get('Access-Control-Allow-Origin'), null);
  } finally {
    ctx.server.close();
    ctx.restore();
  }
});