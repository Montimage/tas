var test = require('node:test');
var assert = require('node:assert');
var { startApp } = require('./helpers/start-app');

test('per-client rate limiting trips with 429 after the configured maximum', async function () {
  var ctx = await startApp({ RATE_LIMIT_MAX: '3', RATE_LIMIT_WINDOW_MS: '60000' });
  try {
    var statuses = [];
    for (var i = 0; i < 5; i++) {
      var res = await fetch(ctx.base + '/api/devops/status');
      statuses.push(res.status);
    }
    assert.deepStrictEqual(statuses, [200, 200, 200, 429, 429]);
    var limited = await fetch(ctx.base + '/api/devops/status');
    assert.strictEqual(limited.status, 429);
    var body = await limited.json();
    assert.ok(body.error);
  } finally {
    ctx.server.close();
    ctx.restore();
  }
});

test('rate limiting is keyed per client (by IP)', async function () {
  var ctx = await startApp({ RATE_LIMIT_MAX: '2', RATE_LIMIT_WINDOW_MS: '60000' }, { host: '::' });
  try {
    // Bind to the dual-stack wildcard so we can reach the same listener from
    // two distinct source addresses (127.0.0.1 and ::1). Each gets its own
    // rate-limit bucket, so the second client is unaffected by the first.
    var port = ctx.port;
    var clientA = 'http://127.0.0.1:' + port;
    var clientB = 'http://[::1]:' + port;

    await fetch(clientA + '/api/devops/status');
    await fetch(clientA + '/api/devops/status');
    var aLimited = await fetch(clientA + '/api/devops/status');
    assert.strictEqual(aLimited.status, 429);

    var bOk = await fetch(clientB + '/api/devops/status');
    assert.strictEqual(bOk.status, 200);
  } finally {
    ctx.server.close();
    ctx.restore();
  }
});

test('normal dashboard-style usage never trips a default-configured limiter', async function () {
  var ctx = await startApp({});
  try {
    var ok = 0;
    for (var i = 0; i < 50; i++) {
      var res = await fetch(ctx.base + '/api/devops/status');
      if (res.status === 200) {
        ok++;
      }
    }
    assert.strictEqual(ok, 50);
  } finally {
    ctx.server.close();
    ctx.restore();
  }
});

test('the rate limiter returns a JSON error body when tripped', async function () {
  var ctx = await startApp({ RATE_LIMIT_MAX: '1', RATE_LIMIT_WINDOW_MS: '60000' });
  try {
    await fetch(ctx.base + '/api/devops/status');
    var res = await fetch(ctx.base + '/api/devops/status');
    assert.strictEqual(res.status, 429);
    var ct = res.headers.get('Content-Type') || '';
    assert.ok(ct.indexOf('application/json') !== -1);
  } finally {
    ctx.server.close();
    ctx.restore();
  }
});