const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('http');
const { startApp } = require('./helpers/start-app');

const APP_SOURCE = fs.readFileSync(path.resolve(__dirname, '../src/server/app.js'), 'utf8');

let ctx;
let server;

/**
 * POST a raw body with an arbitrary content type and collect the response.
 *
 * `test/_http.js` always sends JSON; the urlencoded surface under test here
 * needs the real wire format, so this helper speaks it directly.
 */
function postRaw(pathName, contentType, body) {
  return new Promise((resolve, reject) => {
    const payload = Buffer.from(body);
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: server.address().port,
        path: pathName,
        method: 'POST',
        headers: {
          'Content-Type': contentType,
          'Content-Length': payload.length,
        },
      },
      (res) => {
        let raw = '';
        res.on('data', (c) => (raw += c));
        res.on('end', () => resolve({ status: res.statusCode, raw }));
      }
    );
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

before(async () => {
  ctx = await startApp({}, { login: false });
  server = ctx.server;
  // Probe route outside /api, so no session or CSRF is needed to observe what
  // the body parsers produced. Routes added after app.js finished still match
  // — Express consults the stack in registration order and this path is unique.
  ctx.app.post('/__body-probe', function (req, res) {
    res.json({ body: req.body });
  });
});

after(() => {
  server.close();
  if (ctx.restore) ctx.restore();
});

// ---------------------------------------------------------------------------
// Issue #74: the body parser must not reinstate the nested-object shape that
// the `query parser: simple` setting removes from the query side.
// ---------------------------------------------------------------------------

test('urlencoded bracket notation stays a flat string key (#74)', async () => {
  const res = await postRaw('/__body-probe', 'application/x-www-form-urlencoded', 'a[$ne]=1&b=2');
  assert.equal(res.status, 200);
  const parsed = JSON.parse(res.raw);
  // extended:false keeps every form field a string: `a[$ne]` is the literal
  // key, never the object { a: { $ne: '1' } } the extended parser would build.
  assert.deepEqual(parsed.body, { 'a[$ne]': '1', b: '2' });
  assert.equal(parsed.body.a, undefined, 'no nested object may be constructed');
});

test('plain urlencoded forms keep parsing normally', async () => {
  const res = await postRaw(
    '/__body-probe',
    'application/x-www-form-urlencoded',
    'name=tas&version=1'
  );
  assert.equal(res.status, 200);
  assert.deepEqual(JSON.parse(res.raw).body, { name: 'tas', version: '1' });
});

test('JSON bodies still parse with their original limits', async () => {
  const res = await postRaw(
    '/__body-probe',
    'application/json',
    JSON.stringify({ nested: { ok: true } })
  );
  assert.equal(res.status, 200);
  assert.deepEqual(JSON.parse(res.raw).body, { nested: { ok: true } });
});

// ---------------------------------------------------------------------------
// Source-level pairing assertions, mirroring input-validation.test.js: the
// two settings only deliver the structural guarantee together.
// ---------------------------------------------------------------------------

test('the urlencoded parser runs with extended:false', () => {
  assert.match(
    APP_SOURCE,
    /express\.urlencoded\(\{[\s\S]*?extended:\s*false/,
    'extended:true would rebuild the operator shape on the body side'
  );
  assert.ok(
    !/require\(['"]body-parser['"]\)/.test(APP_SOURCE),
    'body-parser is superseded by Express built-ins (issue #28)'
  );
});

test('the simple query parser pairing is still in place', () => {
  assert.match(APP_SOURCE, /app\.set\(\s*["']query parser["']\s*,\s*["']simple["']\s*\)/);
});

// ---------------------------------------------------------------------------
// Express 5 migration guards (issue #28): path-to-regexp v8 removed the
// anonymous `*` wildcard, so the SPA catch-all must be split explicitly.
// ---------------------------------------------------------------------------

test('the dashboard catch-all serves the SPA at the root and deep paths', async () => {
  for (const pathName of ['/', '/dashboard/deep/link']) {
    const res = await new Promise((resolve, reject) => {
      http
        .get(
          {
            hostname: '127.0.0.1',
            port: server.address().port,
            path: pathName,
          },
          (res) => {
            let raw = '';
            res.on('data', (c) => (raw += c));
            res.on('end', () => resolve({ status: res.statusCode, raw }));
          }
        )
        .on('error', reject);
    });
    assert.equal(res.status, 200, `${pathName} must serve the dashboard`);
    assert.match(res.raw, /<!doctype html/i, `${pathName} must return index.html`);
  }
});
