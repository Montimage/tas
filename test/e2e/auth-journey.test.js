/**
 * End-to-end authenticated journey and unauthenticated rejection suite
 * (issue #14) — the Phase 1 milestone gate.
 *
 * Everything before this file proved a property of a middleware in isolation.
 * This one drives the assembled application and proves the seven things an
 * operator actually depends on:
 *
 *   1. Every endpoint the running application mounts refuses an anonymous
 *      caller, and only the three documented public routes answer without a
 *      session. The route list is read off the live Express table rather than
 *      written down here, so an endpoint added later is enumerated whether or
 *      not anybody remembered this file.
 *   2. The whole authenticated journey — log in, create a topology, run a
 *      simulation, read the report, log out — succeeds.
 *   3. A session that has expired, or been invalidated by logging out, is
 *      refused when its cookie is replayed.
 *   4. A state-changing request without valid CSRF protection is refused,
 *      including over the safe methods that mutate.
 *   5. A structured value supplied where a plain string is declared is rejected
 *      before it can reach the database.
 *   6. Every error response carries the right status and nothing but
 *      `{error, details?}` — no server path, no stack, no raw error.
 *   7. The Phase 0 end-to-end suite is unchanged, so this file cannot have been
 *      made to pass by weakening the gate that came before it.
 *
 * Sections 2 and 3 drive REAL, separately spawned instances over HTTP (see
 * `test/e2e/helpers.js`). Sections 1, 4, 5 and 6 boot the same application
 * in-process, because they need the live route table and a fresh instance per
 * configuration, and they still issue real HTTP requests against it.
 */
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');

const { startApp } = require('../helpers/start-app');
const { collectRoutes } = require('../helpers/route-table');
const { request: inProcessRequest } = require('../_http');
const {
  startServer,
  request,
  unique,
  repoRoot,
  modelsDir,
  inModelsDir,
  removeIfPresent,
} = require('./helpers');
const { PUBLIC_API_ROUTES } = require('../../src/server/middleware/auth');

/** A ceiling high enough that enumerating the whole API cannot trip the limiter. */
const NO_RATE_LIMIT = '100000';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Text that must never appear in a response body: this checkout's own location
 * (derived, so the check still means something wherever CI puts it), the shape
 * of a raw fs error, and the shape of a stack trace.
 *
 * The first eight are the canary list from `test/http-status.test.js`, which
 * was written against the filesystem-backed routes. This suite additionally
 * drives the DATABASE-backed ones and asserts the shape of the 503 they answer
 * with, and a Mongoose connection failure carries its own disclosures the fs
 * list has no entry for: the connection string (host, port and, where one is
 * configured, credentials) and the error class names that name the driver. A
 * regression that echoed the raw connector error into the 503 body would pass
 * every fs canary, so the database ones are added here.
 */
const DISCLOSURES = [
  repoRoot,
  path.dirname(repoRoot),
  'ENOENT',
  'no such file',
  'at Object.',
  'at Function.',
  'node_modules',
  'node:internal',
  'mongodb://',
  'mongodb+srv://',
  'Mongoose',
  'MongoServerError',
  // The two shapes an unreachable connector actually fails with: a name that
  // will not resolve (`EAI_AGAIN mongodb`) and a port nothing is listening on
  // (`ECONNREFUSED 127.0.0.1:27017`). Both name the host the server was
  // configured with, which is the disclosure this list exists to catch.
  'EAI_AGAIN',
  'ECONNREFUSED',
  '27017',
];

// ---------------------------------------------------------------------------
// 1. AC1 - every endpoint refuses an anonymous caller, bar the allowlist
// ---------------------------------------------------------------------------

/**
 * The allowlist as the README documents it. Asserted against the one the gate
 * actually uses, so widening it has to be a deliberate, reviewed change to this
 * file as well as to `src/server/middleware/auth.js` - which is the point: an
 * endpoint silently made public is exactly the regression this suite exists to
 * catch.
 */
const DOCUMENTED_PUBLIC_ROUTES = [
  { method: 'GET', path: '/health' },
  { method: 'POST', path: '/auth/login' },
  { method: 'GET', path: '/auth/session' },
];

/** The same list as `METHOD /api/path` pairs, which is what the walk produces. */
const documentedPublicPairs = DOCUMENTED_PUBLIC_ROUTES.map(
  (route) => `${route.method} /api${route.path}`
).sort();

let anonymousCtx;
/** Every (method, path) pair the live route table declares under `/api`. */
let apiPairs = [];
/** How many distinct routes the walk found, for the vacuity assertion. */
let apiRouteCount = 0;

before(async () => {
  anonymousCtx = await startApp({ RATE_LIMIT_MAX: NO_RATE_LIMIT }, { login: false });
  const router = anonymousCtx.app._router || anonymousCtx.app.router;
  assert.ok(router && router.stack, 'the Express route table must be reachable');

  const apiRoutes = collectRoutes(router.stack, '').filter(
    (route) => route.path === '/api' || route.path.startsWith('/api/')
  );
  apiRouteCount = apiRoutes.length;
  for (const route of apiRoutes) {
    // Express records `_all` as a pseudo-method for `router.all(...)`; it is not
    // something a client can send. Dropping it would drop the whole route from
    // the enumeration, so it is expanded into a concrete GET probe instead - a
    // `router.all(...)` endpoint added later is then still covered.
    const methods = Object.keys(route.methods).filter((method) => method !== '_all');
    if (route.methods._all && !methods.includes('get')) methods.push('get');
    for (const method of methods) {
      apiPairs.push({
        method: method.toUpperCase(),
        // The gate matches a concrete request path at runtime, so the
        // placeholders are filled in with a harmless, well-formed value.
        path: route.path.replace(/:[^/]+/g, 'placeholder.json'),
      });
    }
  }
});

after(async () => {
  if (anonymousCtx) {
    await new Promise((resolve) => anonymousCtx.server.close(resolve));
    anonymousCtx.restore();
  }
});

/**
 * One anchor per `/api` mount in `src/server/app.js`, that the walk must find.
 *
 * A bare count cannot tell "the API shrank by four endpoints" from "a whole
 * router stopped being mounted" - and an unmounted router is the regression
 * that would make the enumeration below report a clean bill of health for
 * endpoints it never probed. Unmounting one router leaves the total well above
 * any floor worth setting (the largest router here is 8 routes of 62), so the
 * floor cannot be what catches it.
 *
 * Every mount is anchored, deliberately: an anchor set that covered only some
 * of them would leave the uncovered ones able to disappear silently, which is
 * the same hole one level down. `app.use('/api', ...)` is mounted three times
 * for `logs/*`, and each mount is anchored separately, because they are three
 * independent registrations that can be lost independently.
 */
const REQUIRED_API_PAIRS = [
  'GET /api/health',
  'POST /api/auth/login',
  'GET /api/models',
  'GET /api/data-recorders/status',
  'POST /api/data-storage',
  'GET /api/logs/data-recorders',
  'GET /api/logs/simulations',
  'GET /api/logs/test-campaigns',
  'GET /api/data-sets',
  'POST /api/test-cases',
  'GET /api/test-campaigns',
  'GET /api/events',
  'GET /api/reports',
  'GET /api/simulation/status',
  'GET /api/devops',
];

test('the live route table yields a plausible number of API endpoints', () => {
  // Without this, a walker that stopped finding routes would make every
  // enumeration below pass vacuously - the failure mode that matters most here,
  // because "no endpoint was reachable anonymously" is also what a broken walk
  // reports.
  assert.ok(
    apiRouteCount >= 55,
    `the walk must find the real route table: it currently holds 62 /api routes, ` +
      `and this walk found only ${apiRouteCount}. This floor catches a walker ` +
      'that stopped finding routes at all; a router that stopped being MOUNTED ' +
      'is caught by the per-mount anchors below, which name it rather than ' +
      'leaving it to be absorbed into a total. If a removal was deliberate and ' +
      'reviewed, lower this floor in the same change'
  );
  assert.ok(
    apiPairs.length >= apiRouteCount,
    `every route must expand to at least one method, got ${apiPairs.length} pairs`
  );

  const enumerated = apiPairs.map((pair) => `${pair.method} ${pair.path}`);
  const missing = REQUIRED_API_PAIRS.filter((pair) => !enumerated.includes(pair));
  assert.deepEqual(
    missing,
    [],
    `these mounts are absent from the walk, so the router carrying each of them ` +
      `is no longer mounted:\n${missing.join('\n')}`
  );
});

test('every API endpoint rejects an anonymous request, bar the documented allowlist', async () => {
  const violations = [];
  const answeredAnonymously = [];
  for (const { method, path: requestPath } of apiPairs) {
    const res = await inProcessRequest(anonymousCtx.server, method, requestPath, undefined, {
      __anonymous: true,
    });
    const rejected = res.status === 401 && res.body && res.body.error === 'Authentication required';
    if (rejected) continue;
    answeredAnonymously.push(`${method} ${requestPath}`);
    if (!documentedPublicPairs.includes(`${method} ${requestPath}`)) {
      violations.push(`${method} ${requestPath} -> ${res.status} ${res.raw}`);
    }
  }
  // Collected rather than thrown on the first one: a reviewer has to see the
  // whole set of endpoints that opened up, not just the alphabetically first.
  assert.deepEqual(
    violations,
    [],
    `these API endpoints answered an anonymous caller:\n${violations.join('\n')}`
  );
  assert.deepEqual(
    answeredAnonymously.sort(),
    documentedPublicPairs,
    'exactly the documented public routes may answer without a session'
  );
});

test('the public allowlist contains exactly the three documented routes', () => {
  assert.deepEqual(
    PUBLIC_API_ROUTES,
    DOCUMENTED_PUBLIC_ROUTES,
    'widening the anonymous allowlist must be a deliberate, reviewed change to ' +
      'this test as well as to src/server/middleware/auth.js'
  );
});

test('the allowlisted routes answer an anonymous caller rather than being gated', async () => {
  const health = await inProcessRequest(anonymousCtx.server, 'GET', '/api/health', undefined, {
    __anonymous: true,
  });
  assert.equal(health.status, 200, `the liveness probe must stay public: ${health.raw}`);

  const session = await inProcessRequest(
    anonymousCtx.server,
    'GET',
    '/api/auth/session',
    undefined,
    { __anonymous: true }
  );
  assert.equal(session.status, 200, `the session probe must stay public: ${session.raw}`);
  assert.equal(session.body.authenticated, false, `expected an anonymous verdict: ${session.raw}`);

  // An empty login body reaching validation is the proof that the gate let it
  // through: a gated request would never have got as far as a schema.
  const login = await inProcessRequest(anonymousCtx.server, 'POST', '/api/auth/login', undefined, {
    __anonymous: true,
  });
  assert.equal(login.status, 400, `login must reach its schema, not the gate: ${login.raw}`);
  assert.equal(login.body.error, 'Validation failed', login.raw);
});

test('an unknown API path is refused with the same 401, so its absence is not probeable', async () => {
  // The gate runs ahead of `apiNotFound`, so an anonymous caller cannot tell an
  // endpoint that exists from one that does not.
  for (const unknown of ['/api/not-a-real-endpoint', '/api/models/../../secrets', '/api/x/y/z']) {
    const res = await inProcessRequest(anonymousCtx.server, 'GET', unknown, undefined, {
      __anonymous: true,
    });
    assert.equal(res.status, 401, `${unknown} must answer 401, got ${res.status}: ${res.raw}`);
    assert.equal(res.body.error, 'Authentication required', res.raw);
  }
});

// ---------------------------------------------------------------------------
// 2. AC2 - the full authenticated journey against a real running instance
// ---------------------------------------------------------------------------

let journey;
/** The topology this journey creates, as `<name>.json`. */
let journeyName;
let journeyFileName;

before(async () => {
  journey = await startServer({ RATE_LIMIT_MAX: NO_RATE_LIMIT });
  journeyName = unique('journey');
});

after(async () => {
  if (journey) await journey.stop();
  // Nothing must be left behind: the journey writes a real topology file, and a
  // run writes a real log file (gitignored, but still this suite's litter).
  if (journeyFileName) removeIfPresent(inModelsDir(journeyFileName));
  if (journeyName) {
    const simulationLogs = path.resolve(repoRoot, 'src/server/logs/simulations');
    let entries = [];
    try {
      entries = fs.readdirSync(simulationLogs);
    } catch (_) {
      entries = []; // absent, which is the expected case on a fresh checkout
    }
    for (const entry of entries) {
      if (entry.startsWith(`${journeyName}_`)) removeIfPresent(path.join(simulationLogs, entry));
    }
  }
});

test('journey step 1: logging in yields a session cookie and a CSRF token', async () => {
  assert.ok(journey.cookie, 'login must return a session cookie');
  assert.match(journey.cookie, /tas\.sid=/, `expected a session cookie, got ${journey.cookie}`);
  assert.equal(typeof journey.csrfToken, 'string', 'login must return a CSRF token');
  assert.ok(journey.csrfToken.length > 0, 'the CSRF token must not be empty');

  const session = await request(journey.baseUrl, 'GET', '/api/auth/session');
  assert.equal(session.status, 200, `the session probe must answer: ${session.raw}`);
  assert.equal(
    session.body.authenticated,
    true,
    `expected an authenticated verdict: ${session.raw}`
  );
});

test('journey step 2: an authenticated caller creates a topology', async () => {
  const res = await request(journey.baseUrl, 'POST', '/api/models', {
    body: { model: { name: journeyName, devices: [] } },
  });
  assert.equal(res.status, 200, `creating a topology must succeed: ${res.raw}`);
  journeyFileName = res.body && res.body.modelFileName;
  assert.equal(journeyFileName, `${journeyName}.json`, `unexpected file name: ${res.raw}`);
  assert.ok(fs.existsSync(inModelsDir(journeyFileName)), 'the topology file must exist on disk');
});

test('journey step 3: the topology reads back with the name it was created under', async () => {
  const res = await request(journey.baseUrl, 'GET', `/api/models/${journeyFileName}`);
  assert.equal(res.status, 200, `reading the topology back must succeed: ${res.raw}`);
  assert.equal(res.body.error, null, res.raw);
  assert.equal(res.body.model.name, journeyName, `the name must round-trip: ${res.raw}`);
});

test('journey step 4: an authenticated caller is authorised to run a simulation', async () => {
  const start = await request(journey.baseUrl, 'POST', '/api/simulation/start', {
    body: { modelFileName: journeyFileName },
  });
  // The run has to actually START, not merely be authorised. The route reads
  // its data-storage configuration off disk and registers the run without
  // needing a reachable database, so 200 is the outcome here - a 409 (topology
  // already in use, impossible for a name minted for this run) or a 503 would
  // mean the journey's central step never happened. An accepted-status set wide
  // enough to absorb those would let this test stay green with no simulation
  // ever running, which is exactly the vacuity this suite exists to prevent.
  //
  // The run stays running until it is stopped because step 2 creates the
  // topology with no devices, and a run only returns to OFFLINE when a device
  // reports finished. Giving step 2 a real device would make the `isRunning`
  // assertions below timing-dependent.
  assert.notEqual(start.status, 401, `an authenticated caller must not be refused: ${start.raw}`);
  assert.notEqual(start.status, 403, `a correctly tokened start must not be refused: ${start.raw}`);
  assert.equal(start.status, 200, `the run must start, not merely be authorised: ${start.raw}`);

  // The registry entry is the evidence the run exists; the status code alone is
  // not, because the route answers before the registry is consulted.
  const started = Object.values(start.body.simulationStatus || {}).find(
    (entry) => entry && entry.model === journeyName
  );
  assert.ok(started, `the run must be registered under ${journeyName}: ${start.raw}`);
  assert.equal(
    started.modelFileName,
    journeyFileName,
    `the registered run must name the topology it was started from: ${start.raw}`
  );
  assert.equal(started.isRunning, true, `the registered run must be running: ${start.raw}`);

  const status = await request(journey.baseUrl, 'GET', '/api/simulation/status');
  assert.equal(status.status, 200, `the simulation status must be readable: ${status.raw}`);
  // `assert.ok(status.body.simulationStatus)` would be a tautology: the route
  // sends an empty object when nothing ran, and `{}` is truthy. The run this
  // journey started has to be in it.
  const reported = Object.values(status.body.simulationStatus || {}).find(
    (entry) => entry && entry.model === journeyName
  );
  assert.ok(reported, `the status map must report the run this journey started: ${status.raw}`);
  assert.equal(reported.isRunning, true, `the run must be reported as running: ${status.raw}`);
});

test('journey step 5: the report endpoint is authorised, and answers 503 when no database is reachable', async () => {
  // CONSTRAINT: `GET /api/reports` is the one journey step that genuinely needs
  // MongoDB - it sits behind `dbConnector`. This suite provisions no database,
  // so in CI the DB-backed body is NOT exercised: what is asserted then is the
  // documented unavailability contract (503 `Database is unavailable`), which
  // is a real property of the API, not a stand-in for the 200. Where a database
  // IS reachable the same test asserts the 200 and its `reports` array.
  const res = await request(
    journey.baseUrl,
    'GET',
    `/api/reports?topologyFileName=${encodeURIComponent(journeyFileName)}`
  );
  assert.notEqual(res.status, 401, `an authenticated caller must not be refused: ${res.raw}`);
  assert.notEqual(res.status, 403, `a safe-method read must not need a token: ${res.raw}`);
  assert.ok(
    [200, 503].includes(res.status),
    `expected 200 or the documented 503, got ${res.status}: ${res.raw}`
  );
  if (res.status === 200) {
    assert.ok(Array.isArray(res.body.reports), `expected a reports array: ${res.raw}`);
  } else {
    assert.equal(res.body.error, 'Database is unavailable', res.raw);
  }
});

test('journey step 6: stopping the simulation is accepted with the CSRF token', async () => {
  // `GET /api/simulation/stop/:fileName` mutates over a safe method, so the
  // guard demands the token here as it would on a POST.
  const res = await request(journey.baseUrl, 'GET', `/api/simulation/stop/${journeyFileName}`, {
    anonymous: true,
    headers: { Cookie: journey.cookie, 'X-CSRF-Token': journey.csrfToken },
  });
  assert.notEqual(res.status, 403, `a correctly tokened stop must not be refused: ${res.raw}`);
  assert.equal(res.status, 200, `stopping the run must succeed: ${res.raw}`);

  // 200 on its own proves nothing about stopping: the route answers it whether
  // or not the topology names a live run. What proves the stop reached the
  // registry is the run this journey started being marked stopped in the
  // response the route sends back.
  const stopped = Object.values(res.body.simulationStatus || {}).find(
    (entry) => entry && entry.model === journeyName
  );
  assert.ok(stopped, `the stopped run must still be reported: ${res.raw}`);
  assert.equal(stopped.isRunning, false, `the run must be marked stopped: ${res.raw}`);
  assert.equal(
    typeof stopped.endTime,
    'number',
    `a stopped run must carry the time it stopped: ${res.raw}`
  );
});

test('journey step 7: logging out ends the session, and replaying its cookie fails', async () => {
  // The topology is removed first, while the session that created it is still
  // valid - the checkout must be left exactly as it was found.
  const removed = await request(journey.baseUrl, 'DELETE', `/api/models/${journeyFileName}`);
  assert.equal(removed.status, 200, `deleting the topology must succeed: ${removed.raw}`);
  assert.ok(!fs.existsSync(inModelsDir(journeyFileName)), 'the topology file must be gone');

  const logout = await request(journey.baseUrl, 'POST', '/api/auth/logout');
  assert.equal(logout.status, 200, `logging out must succeed: ${logout.raw}`);
  assert.equal(logout.body.authenticated, false, logout.raw);

  const replayed = await request(journey.baseUrl, 'GET', '/api/models', {
    anonymous: true,
    headers: { Cookie: journey.cookie },
  });
  assert.equal(replayed.status, 401, `a destroyed session must not be usable: ${replayed.raw}`);
  assert.equal(replayed.body.error, 'Authentication required', replayed.raw);
});

test('the journey leaves the topology directory exactly as it found it', async () => {
  assert.ok(
    !fs.readdirSync(modelsDir).some((entry) => entry.startsWith(journeyName)),
    'no artifact of the journey may survive it'
  );
});

// ---------------------------------------------------------------------------
// 3. AC3 - an expired or invalidated session is refused
// ---------------------------------------------------------------------------

test('a session that has been idle past SESSION_TTL_MS is refused', async () => {
  // The TTL has to outlast spawning a process and issuing the first request, or
  // a loaded runner turns the pre-expiry assertion red for reasons that have
  // nothing to do with session expiry. The property under test - that an idle
  // session past its TTL is refused - is unchanged by the wider window.
  const expiring = await startServer({
    SESSION_TTL_MS: '500',
    RATE_LIMIT_MAX: NO_RATE_LIMIT,
  });
  try {
    const before = await request(expiring.baseUrl, 'GET', '/api/models', {
      anonymous: true,
      headers: { Cookie: expiring.cookie },
    });
    assert.equal(before.status, 200, `the fresh session must be served: ${before.raw}`);

    await sleep(1200);

    const after = await request(expiring.baseUrl, 'GET', '/api/models', {
      anonymous: true,
      headers: { Cookie: expiring.cookie },
    });
    assert.equal(after.status, 401, `an idle session must expire: ${after.raw}`);
    assert.equal(after.body.error, 'Authentication required', after.raw);
  } finally {
    await expiring.stop();
  }
});

test('a session invalidated by logging out is refused when its cookie is replayed', async () => {
  // The same property as journey step 7, asserted here against a dedicated
  // instance so the invalidation half stands on its own if the journey changes.
  const ctx = await startApp({ RATE_LIMIT_MAX: NO_RATE_LIMIT });
  try {
    const before = await inProcessRequest(ctx.server, 'GET', '/api/models');
    assert.equal(before.status, 200, `the live session must be served: ${before.raw}`);

    const logout = await inProcessRequest(ctx.server, 'POST', '/api/auth/logout');
    assert.equal(logout.status, 200, `logging out must succeed: ${logout.raw}`);

    const replayed = await inProcessRequest(ctx.server, 'GET', '/api/models', undefined, {
      __anonymous: true,
      Cookie: ctx.cookie,
    });
    assert.equal(replayed.status, 401, `a destroyed session must not be usable: ${replayed.raw}`);
    assert.equal(replayed.body.error, 'Authentication required', replayed.raw);
  } finally {
    await new Promise((resolve) => ctx.server.close(resolve));
    ctx.restore();
  }
});

// ---------------------------------------------------------------------------
// 4. AC4 - a state-changing request without valid CSRF protection is refused
// ---------------------------------------------------------------------------

/**
 * A state-changing request whose handler writes nothing to disk: it sits behind
 * the database connector, so even a regression that let it past the guard could
 * only reach a 503 here. That keeps these assertions about the guard alone.
 */
const csrfProbeBody = { testCase: { id: 'csrf-probe', name: 'csrf probe' } };

let csrfCtx;

before(async () => {
  csrfCtx = await startApp({ RATE_LIMIT_MAX: NO_RATE_LIMIT });
});

after(async () => {
  if (csrfCtx) {
    await new Promise((resolve) => csrfCtx.server.close(resolve));
    csrfCtx.restore();
  }
});

test('a state-changing request with a session but no CSRF token is refused', async () => {
  const res = await inProcessRequest(csrfCtx.server, 'POST', '/api/test-cases', csrfProbeBody, {
    __anonymous: true,
    Cookie: csrfCtx.cookie,
  });
  assert.equal(res.status, 403, `expected a CSRF rejection, got ${res.status}: ${res.raw}`);
  assert.equal(res.body.error, 'Invalid CSRF token', res.raw);
});

test('a state-changing request with the wrong CSRF token is refused', async () => {
  for (const token of ['not-the-token', '', `${csrfCtx.csrfToken}x`, csrfCtx.csrfToken.slice(1)]) {
    const res = await inProcessRequest(csrfCtx.server, 'POST', '/api/test-cases', csrfProbeBody, {
      __anonymous: true,
      Cookie: csrfCtx.cookie,
      'X-CSRF-Token': token,
    });
    assert.equal(res.status, 403, `token ${JSON.stringify(token)}: ${res.raw}`);
    assert.equal(res.body.error, 'Invalid CSRF token', res.raw);
  }
});

test('a mutating safe-method route without the CSRF token is refused too', async () => {
  // The method-based skip is only sound while GET really is safe. These two
  // change state over GET, so the skip must not reach them - otherwise a link on
  // any page an operator visits while logged in would trigger them.
  for (const mutatingGet of ['/api/simulation/stop/placeholder.json', '/api/devops/start']) {
    const res = await inProcessRequest(csrfCtx.server, 'GET', mutatingGet, undefined, {
      __anonymous: true,
      Cookie: csrfCtx.cookie,
    });
    assert.equal(res.status, 403, `${mutatingGet} must demand a token: ${res.status} ${res.raw}`);
    assert.equal(res.body.error, 'Invalid CSRF token', res.raw);
  }
});

// ---------------------------------------------------------------------------
// 5. AC5 - a structured value where a plain string is declared is rejected
// ---------------------------------------------------------------------------

/** Assert the standard machine-readable validation failure shape. */
const assertValidationError = (res, context) => {
  assert.equal(res.status, 400, `expected 400 for ${context}, got ${res.status}: ${res.raw}`);
  assert.equal(res.body.error, 'Validation failed', `unexpected error text: ${res.raw}`);
  assert.ok(Array.isArray(res.body.details), `details must be an array: ${res.raw}`);
  assert.ok(res.body.details.length > 0, `details must name a field: ${res.raw}`);
};

test('an object supplied where a string is declared is rejected before any handler runs', async () => {
  const res = await inProcessRequest(csrfCtx.server, 'POST', '/api/models', {
    model: { name: { $ne: null }, devices: [] },
  });
  assertValidationError(res, 'an operator document in place of a topology name');
  assert.deepEqual(
    fs.readdirSync(modelsDir).filter((entry) => entry.includes('$ne')),
    [],
    'a rejected name must never reach the filesystem'
  );
});

test('an array supplied where a string is declared is rejected', async () => {
  const res = await inProcessRequest(csrfCtx.server, 'POST', '/api/models', {
    model: { name: ['topology'], devices: [] },
  });
  assertValidationError(res, 'an array in place of a topology name');
});

/**
 * The three requests in this file that reach the database layer, issued
 * together and answered once.
 *
 * Each of them waits out the full connection timeout where no database is
 * provisioned (the CI case), so issuing them one test at a time costs that
 * timeout three times over for no extra coverage. They are independent - two
 * different instances, no shared state - so they are fired concurrently on
 * first use and each test below asserts its own answer.
 */
let databaseProbes = null;

/**
 * @returns {Promise<{operatorQuery: Object, validQuery: Object, bareQuery: Object}>}
 */
const probeDatabaseBackedEndpoints = () => {
  if (!databaseProbes) {
    databaseProbes = Promise.all([
      inProcessRequest(csrfCtx.server, 'GET', '/api/reports?topologyFileName[$ne]=x'),
      inProcessRequest(csrfCtx.server, 'GET', '/api/reports?topologyFileName=well-formed.json'),
      inProcessRequest(errorCtx.server, 'GET', '/api/reports'),
    ]).then(([operatorQuery, validQuery, bareQuery]) => ({
      operatorQuery,
      validQuery,
      bareQuery,
    }));
  }
  return databaseProbes;
};

test('a Mongo operator cannot be expressed in the query string at all', async () => {
  // With `query parser: simple` the bracket notation is not parsed, so
  // `?topologyFileName[$ne]=x` arrives as the literal key
  // `topologyFileName[$ne]` - which no schema declares, so it is stripped. The
  // value therefore cannot reach the database as an operator document by any
  // route: the request is either served (no filter) or refused by the connector.
  const { operatorQuery: res } = await probeDatabaseBackedEndpoints();
  assert.notEqual(res.status, 500, `an operator probe must not break the server: ${res.raw}`);
  assert.ok(
    [200, 503].includes(res.status),
    `expected the operator key to be stripped, got ${res.status}: ${res.raw}`
  );
  assert.ok(!res.raw.includes('$ne'), `the operator must not be echoed back: ${res.raw}`);
});

test('validation short-circuits ahead of the database layer', async () => {
  // The proof that the 400 arrives BEFORE anything is asked of the database:
  // the same endpoint, with a well-formed query, gets as far as `dbConnector`
  // and answers 503 (or 200 where a database is reachable). With an
  // over-long - i.e. schema-violating - value it answers 400 instead, so the
  // schema decided the outcome without the connector ever being consulted.
  const { validQuery: valid } = await probeDatabaseBackedEndpoints();
  assert.ok(
    [200, 503].includes(valid.status),
    `a well-formed query must reach the database layer, got ${valid.status}: ${valid.raw}`
  );
  if (valid.status === 503) {
    assert.equal(valid.body.error, 'Database is unavailable', valid.raw);
  }

  const malformed = await inProcessRequest(
    csrfCtx.server,
    'GET',
    `/api/reports?topologyFileName=${'x'.repeat(2000)}`
  );
  assertValidationError(malformed, 'a query value past its declared maximum');
});

// ---------------------------------------------------------------------------
// 6. AC6 - every error response carries the right status and nothing else
// ---------------------------------------------------------------------------

/**
 * Every key in a parsed body, at every depth - so the disclosure checks below
 * walk the whole response rather than only its top-level `error`.
 * @param {*} value Parsed JSON body
 * @returns {String[]} Every key name found
 */
const allKeys = (value) => {
  if (Array.isArray(value)) return value.flatMap(allKeys);
  if (value && typeof value === 'object') {
    return Object.keys(value).concat(Object.values(value).flatMap(allKeys));
  }
  return [];
};

/** Assert an error response is the one shape the API has, and carries nothing more. */
const assertErrorShape = (res, status, context) => {
  assert.equal(
    res.status,
    status,
    `expected ${status} for ${context}, got ${res.status}: ${res.raw}`
  );
  assert.ok(res.body, `${context} must answer with JSON: ${res.raw}`);
  assert.equal(typeof res.body.error, 'string', `${context} must carry a string error: ${res.raw}`);
  assert.ok(res.body.error.length > 0, `${context} must carry a message: ${res.raw}`);
  assert.deepEqual(
    Object.keys(res.body).filter((key) => key !== 'error' && key !== 'details'),
    [],
    `an error body carries nothing but error and details: ${res.raw}`
  );
  assert.ok(!allKeys(res.body).includes('stack'), `${context} must not carry a stack: ${res.raw}`);
  for (const disclosure of DISCLOSURES) {
    assert.ok(
      !res.raw.includes(disclosure),
      `${context} must not disclose ${disclosure}: ${res.raw}`
    );
  }
};

let errorCtx;

before(async () => {
  // A small body limit so the 413 costs a kilobyte rather than a megabyte.
  errorCtx = await startApp({ RATE_LIMIT_MAX: NO_RATE_LIMIT, BODY_LIMIT: '1kb' });
});

after(async () => {
  if (errorCtx) {
    await new Promise((resolve) => errorCtx.server.close(resolve));
    errorCtx.restore();
  }
});

test('a 400, a 401, a 403 and a 404 each carry the right status and no server detail', async () => {
  const validation = await inProcessRequest(errorCtx.server, 'POST', '/api/models', {
    model: { name: { $ne: null }, devices: [] },
  });
  assertErrorShape(validation, 400, 'a validation failure');
  assert.equal(validation.body.error, 'Validation failed', validation.raw);

  const anonymous = await inProcessRequest(errorCtx.server, 'GET', '/api/models', undefined, {
    __anonymous: true,
  });
  assertErrorShape(anonymous, 401, 'an anonymous request');
  assert.equal(anonymous.body.error, 'Authentication required', anonymous.raw);

  const forged = await inProcessRequest(errorCtx.server, 'POST', '/api/test-cases', csrfProbeBody, {
    __anonymous: true,
    Cookie: errorCtx.cookie,
  });
  assertErrorShape(forged, 403, 'a request without CSRF protection');
  assert.equal(forged.body.error, 'Invalid CSRF token', forged.raw);

  const unknown = await inProcessRequest(errorCtx.server, 'GET', '/api/not-a-real-endpoint');
  assertErrorShape(unknown, 404, 'an authenticated request for an unknown API path');
  assert.equal(unknown.body.error, 'Not found', unknown.raw);
  assert.ok(
    !unknown.raw.includes('<!DOCTYPE'),
    `an unknown API path must not be answered with the dashboard: ${unknown.raw}`
  );

  const missing = await inProcessRequest(
    errorCtx.server,
    'GET',
    `/api/models/${unique('absent')}.json`
  );
  assertErrorShape(missing, 404, 'a topology that is not there');
});

test('an oversized body and an unsupported encoding are refused without server detail', async () => {
  const oversized = await inProcessRequest(errorCtx.server, 'POST', '/api/models', {
    model: { name: 'x'.repeat(4096), devices: [] },
  });
  assertErrorShape(oversized, 413, 'a body past the configured limit');
  assert.equal(oversized.body.error, 'Request entity too large', oversized.raw);

  const encoded = await inProcessRequest(
    errorCtx.server,
    'POST',
    '/api/models',
    { model: { name: 'encoded', devices: [] } },
    { 'Content-Encoding': 'not-an-encoding' }
  );
  assertErrorShape(encoded, 415, 'an unsupported content encoding');
  assert.equal(encoded.body.error, 'Unsupported content encoding', encoded.raw);
});

test('the database-unavailable refusal is a documented 503 that discloses nothing', async () => {
  // Only meaningful where no database is reachable, which is the CI case; where
  // one IS reachable the endpoint answers 200 and there is no error body to
  // inspect, so the assertion is on whichever of the two arrives.
  const { bareQuery: res } = await probeDatabaseBackedEndpoints();
  assert.ok(
    [200, 503].includes(res.status),
    `expected 200 or the documented 503, got ${res.status}: ${res.raw}`
  );
  if (res.status === 503) {
    assertErrorShape(res, 503, 'an unreachable database');
    assert.equal(res.body.error, 'Database is unavailable', res.raw);
  }
});

// ---------------------------------------------------------------------------
// 7. AC7 - the Phase 0 suite is unchanged
// ---------------------------------------------------------------------------

/**
 * The Phase 0 end-to-end suite (issue #8) and the helper it is built on, pinned
 * by content digest.
 *
 * The contract these digests express: these four files ARE the Phase 0 gate.
 * Changing any of them must be a deliberate, reviewed act that also updates the
 * digest below in the same change - so the edit is visible in the diff and has
 * to be argued for, rather than slipping through as a line removed from a file
 * nobody re-read. This test exists so that a future edit to the Phase 1 suite
 * cannot silently weaken the Phase 0 one.
 *
 * The actual proof that Phase 0 still PASSES is the full `npm test` run, which
 * executes these files unchanged alongside this one. This test asserts only the
 * other half: that they are still the files that were reviewed.
 *
 * Deliberately git-free. An earlier version resolved a fork point with
 * `git merge-base` and diffed against it, which does not gate in CI: the
 * workflow checks out at depth 1, so no base ref exists, the comparison cannot
 * be made, and the run goes green having asserted nothing. A digest of the
 * bytes on disk needs no repository, no network and no environment, so it
 * always runs and always means the same thing.
 *
 * Line endings are normalised to LF before hashing so a CRLF checkout on
 * Windows does not report a difference that is not there.
 */
const PHASE_0_DIGESTS = {
  'test/e2e/security-suite.test.js':
    'e87f06ec6d8d4b79517e37cef2e7064d5ab935ca2c38a838cf62c849354423b9',
  'test/e2e/limits.test.js': 'a6094dfd19c166e847a7068c5b62c0f3bf369cf2bad84566ebacce27d9a589e2',
  'test/e2e/container-nonroot.test.js':
    'c12d16b7554d32a9baee7d96cab44641efd5ae96cdb7b1a37ea1d146a480cd44',
  'test/e2e/helpers.js': '4a7794adf00813e01c9a36c416a14c40463f3aa59e16325b18a4f8850024f975',
};

/**
 * The SHA-256 of a file's content with line endings normalised to LF.
 * @param {String} file Repo-relative path
 * @returns {String} Lowercase hex digest
 */
const phase0Digest = (file) =>
  createHash('sha256')
    .update(fs.readFileSync(path.resolve(repoRoot, file), 'utf8').replace(/\r\n/g, '\n'))
    .digest('hex');

test('the Phase 0 end-to-end suite is byte-identical to its reviewed content', () => {
  // Collected rather than thrown on the first mismatch: a reviewer has to see
  // every Phase 0 file that moved, not just the first one in the list.
  const drifted = [];
  for (const [file, expected] of Object.entries(PHASE_0_DIGESTS)) {
    const actual = phase0Digest(file);
    if (actual !== expected) {
      drifted.push(`${file}\n  expected sha256 ${expected}\n  actual   sha256 ${actual}`);
    }
  }
  assert.deepEqual(
    drifted,
    [],
    'the Phase 0 gate must not be weakened to make the Phase 1 suite pass - ' +
      'these files no longer match their reviewed content. If the change is ' +
      'deliberate, update PHASE_0_DIGESTS in this file in the same commit:\n' +
      drifted.join('\n')
  );
});
