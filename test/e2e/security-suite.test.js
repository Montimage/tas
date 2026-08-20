/**
 * End-to-end security regression suite (issue #8).
 *
 * Starts a REAL server instance as a child process and drives it over HTTP -
 * it never imports the Express app or calls handlers in-process. It proves the
 * filesystem-containment (GHSA-4qmg-22w8-qmj4), name-sanitisation
 * (GHSA-9348-cgrv-c89w) and CORS (GHSA-m5x4-v76j-c4qq) fixes hold against a
 * running instance, and that legitimate topology flows still succeed.
 */
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  startServer,
  request,
  unique,
  repoPackageJson,
  devopsConfigPath,
  campaignLogsDir,
  modelsDir,
  recordersDir,
  inModelsDir,
  escapeArtifacts,
  escapedCampaignLogs,
  removeIfPresent,
  listDir,
  allowedOrigin,
  hostileOrigin,
} = require('./helpers');

/** Hostile base names this suite tries to write outside the storage root. */
const escapeNames = ['escape', 'pwned'];

/** Hostile test campaign id used to probe the devops log path (issue #55). */
const hostileCampaignId = '../../../pwned-campaign';

let server;
let originalDevops;

before(async () => {
  // The devops tests below overwrite the shipped configuration, so snapshot it
  // and restore it in `after` - a failing run must not leave the checkout dirty.
  originalDevops = fs.readFileSync(devopsConfigPath, 'utf8');
  // Configure the real instance with the trusted origin shipped in tests.
  server = await startServer({ CORS_ALLOWED_ORIGINS: allowedOrigin });
});

after(async () => {
  if (server) await server.stop();
  // This suite is the regression gate, so it runs red against an unfixed
  // instance - which really does escape files into the source tree. Remove
  // them so a failing run never leaves the checkout dirty.
  for (const name of escapeNames) {
    escapeArtifacts(name).forEach(removeIfPresent);
  }
  escapedCampaignLogs('pwned-campaign').forEach(removeIfPresent);
  // Guarded: if the snapshot itself failed, restoring would mask the real error.
  if (originalDevops !== undefined) {
    fs.writeFileSync(devopsConfigPath, originalDevops);
  }
});

// ---------------------------------------------------------------------------
// A real instance is started and driven over HTTP
// ---------------------------------------------------------------------------

test('suite drives a real running instance over HTTP', async () => {
  const res = await request(server.baseUrl, 'GET', '/');
  assert.equal(res.status, 200, 'dashboard root must be served by the real instance');
  const api = await request(server.baseUrl, 'GET', '/api/models/');
  assert.equal(api.status, 200, 'API must be reachable over HTTP');
  // Assert the response parsed before reading through it, so a non-JSON body
  // reports the real failure instead of a TypeError.
  assert.ok(api.body, `API must answer with JSON, got: ${api.raw}`);
  assert.equal(api.body.error, null);
});

// ---------------------------------------------------------------------------
// Hostile names - every affected route family rejects them with no file
// read, written or removed. Payload corpus mirrors GHSA guidance.
// ---------------------------------------------------------------------------

test('path containment: models GET rejects traversal with no path disclosure', async () => {
  const attempts = [
    '/api/models/..%2Fpackage.json',
    '/api/models/%2e%2e%2fpackage.json',
    '/api/models/..%2F..%2F..%2Fetc%2Fpasswd',
    '/api/models/..%2F..%2Fpackage-lock.json',
  ];
  for (const p of attempts) {
    const res = await request(server.baseUrl, 'GET', p);
    assert.equal(res.status, 400, `expected 400 for ${p}, got ${res.status} (${res.raw})`);
    assert.ok(!res.raw.includes('package.json'), `must not leak target: ${res.raw}`);
    assert.ok(!res.raw.includes('/home/'), `must not leak server paths: ${res.raw}`);
    assert.ok(!res.raw.includes('workspace'), `must not leak server paths: ${res.raw}`);
    assert.ok(!res.raw.includes('models/data'), `must not leak storage path: ${res.raw}`);
  }
});

test('path containment: models GET and DELETE leave files untouched', async () => {
  assert.ok(fs.existsSync(repoPackageJson), 'canary must exist');
  const beforeList = await listDir(modelsDir);
  const del = await request(server.baseUrl, 'DELETE', '/api/models/..%2Fpackage.json');
  assert.equal(del.status, 400, 'traversal delete must be rejected');
  assert.ok(fs.existsSync(repoPackageJson), 'canary must NOT be deleted');
  const get = await request(server.baseUrl, 'GET', '/api/models/%2e%2e%2fpackage.json');
  assert.equal(get.status, 400, 'traversal read must be rejected');
  const afterList = await listDir(modelsDir);
  assert.deepEqual(afterList, beforeList, 'no file written or removed in the models dir');
});

test('path containment: data-recorders GET and DELETE reject traversal', async () => {
  assert.ok(fs.existsSync(repoPackageJson));
  const beforeList = await listDir(recordersDir);
  const get = await request(server.baseUrl, 'GET', '/api/data-recorders/models/..%2Fpackage.json');
  assert.equal(get.status, 400);
  assert.ok(!get.raw.includes('workspace'));
  const del = await request(
    server.baseUrl,
    'DELETE',
    '/api/data-recorders/models/..%2Fpackage.json'
  );
  assert.equal(del.status, 400);
  assert.ok(fs.existsSync(repoPackageJson), 'canary must not be deleted');
  assert.deepEqual(await listDir(recordersDir), beforeList, 'recorders dir untouched');
});

test('path containment: logs GET and DELETE reject traversal across all log families', async () => {
  assert.ok(fs.existsSync(repoPackageJson));
  const families = ['data-recorders', 'simulations', 'test-campaigns'];
  for (const family of families) {
    const target = `/api/logs/${family}/..%2Fpackage.json`;
    const get = await request(server.baseUrl, 'GET', target);
    assert.equal(get.status, 400, `${family} GET must be rejected`);
    assert.ok(!get.raw.includes('package.json'), `${family} GET must not leak`);
    const del = await request(server.baseUrl, 'DELETE', target);
    assert.equal(del.status, 400, `${family} DELETE must be rejected`);
  }
  assert.ok(fs.existsSync(repoPackageJson), 'canary must not be deleted');
});

test('path containment: simulation start rejects a hostile modelFileName in the body', async () => {
  const res = await request(server.baseUrl, 'POST', '/api/simulation/start', {
    body: {
      modelFileName: '..%2Fpackage.json',
      model: { name: unique('sim'), devices: [] },
    },
  });
  assert.equal(res.status, 400, 'hostile simulation modelFileName must be rejected');
  assert.ok(fs.existsSync(repoPackageJson));
});

test('path containment: data-recorders start rejects a hostile dataRecorderFileName in the body', async () => {
  const res = await request(server.baseUrl, 'POST', '/api/data-recorders/start', {
    body: {
      dataRecorderFileName: '../../package.json',
      model: { name: unique('dr'), dataRecorders: [] },
    },
  });
  assert.equal(res.status, 400, 'hostile recorder dataRecorderFileName must be rejected');
  assert.ok(fs.existsSync(repoPackageJson));
});

// ---------------------------------------------------------------------------
// Issue #55 - the remaining name-derived paths (devops, test-cases).
//
// Both sinks sit behind the database connector, and the containment guards run
// ahead of it on purpose: a rejection must not depend on a reachable database.
// Every assertion below therefore returns immediately, and a regression that
// moves a guard back behind the connector shows up as a non-400 response.
// ---------------------------------------------------------------------------

test('path containment: devops POST rejects a hostile testCampaignId and persists nothing', async () => {
  const before = fs.readFileSync(devopsConfigPath, 'utf8');
  const hostile = [hostileCampaignId, '../../pwned-campaign', 'a/b', '..', '.'];
  for (const testCampaignId of hostile) {
    const res = await request(server.baseUrl, 'POST', '/api/devops', {
      body: {
        devops: { webhookURL: 'http://localhost:3333/webhook', testCampaignId },
      },
    });
    assert.equal(
      res.status,
      400,
      `expected 400 for testCampaignId ${JSON.stringify(testCampaignId)}, got ${res.status} (${
        res.raw
      })`
    );
    assert.ok(!res.raw.includes('/home/'), `must not leak server paths: ${res.raw}`);
    assert.ok(!res.raw.includes('workspace'), `must not leak server paths: ${res.raw}`);
  }
  assert.equal(
    fs.readFileSync(devopsConfigPath, 'utf8'),
    before,
    'a rejected configuration must never reach devops.json'
  );
});

test('path containment: a persisted hostile testCampaignId is rejected on read-back and writes no log', async () => {
  // An unvalidated build could already have written a hostile id, so the read
  // side is a distinct gate. A dedicated instance is used because the running
  // server caches the configuration it has already loaded.
  fs.writeFileSync(
    devopsConfigPath,
    JSON.stringify({
      webhookURL: 'http://localhost:3333/webhook',
      testCampaignId: hostileCampaignId,
    })
  );
  const poisoned = await startServer({ CORS_ALLOWED_ORIGINS: allowedOrigin });
  try {
    const res = await request(poisoned.baseUrl, 'GET', '/api/devops/start');
    assert.equal(res.status, 400, `a persisted hostile id must be rejected (${res.raw})`);
    assert.ok(!res.raw.includes('/home/'), `must not leak server paths: ${res.raw}`);
    assert.ok(!res.raw.includes('workspace'), `must not leak server paths: ${res.raw}`);
    assert.deepEqual(
      escapedCampaignLogs('pwned-campaign'),
      [],
      'no log file may be created outside the test-campaign log root'
    );
  } finally {
    await poisoned.stop();
    fs.writeFileSync(devopsConfigPath, originalDevops);
  }
});

test('path containment: test-cases POST rejects a hostile modelFileName', async () => {
  const hostile = [
    '../../../package.json',
    '../package.json',
    '/etc/passwd',
    'a/../../../package.json',
  ];
  for (const modelFileName of hostile) {
    const res = await request(server.baseUrl, 'POST', '/api/test-cases', {
      body: { testCase: { id: unique('tc'), name: 'tc', modelFileName } },
    });
    assert.equal(
      res.status,
      400,
      `expected 400 for modelFileName ${JSON.stringify(modelFileName)}, got ${res.status} (${
        res.raw
      })`
    );
    assert.ok(!res.raw.includes('/home/'), `must not leak server paths: ${res.raw}`);
    assert.ok(!res.raw.includes('workspace'), `must not leak server paths: ${res.raw}`);
  }
  assert.ok(fs.existsSync(repoPackageJson), 'canary must be untouched');
});

test('path containment: test-cases POST /:id rejects a hostile modelFileName', async () => {
  const res = await request(server.baseUrl, 'POST', '/api/test-cases/any-id', {
    body: { testCase: { modelFileName: '../../../package.json' } },
  });
  assert.equal(
    res.status,
    400,
    `the update path must not be a way around the create-time check (${res.raw})`
  );
  assert.ok(fs.existsSync(repoPackageJson));
});

test('legitimate devops starts and test-case creations pass containment', async () => {
  // Containment is the only thing this change can break on the happy path, so
  // that is what is asserted: a legitimate request must not be rejected. The
  // requests are issued together because neither route can answer without a
  // database, and the suite does not provision one - apart, each would wait
  // out the full connect timeout in turn.
  const withModel = unique('tc');
  const withoutModel = unique('tc');
  const [start, create, noModel] = await Promise.all([
    request(server.baseUrl, 'GET', '/api/devops/start'),
    request(server.baseUrl, 'POST', '/api/test-cases', {
      body: {
        testCase: {
          id: withModel,
          name: 'legitimate test case',
          modelFileName: '202402-Temperature-Controller.json',
        },
      },
    }),
    request(server.baseUrl, 'POST', '/api/test-cases', {
      body: {
        testCase: { id: withoutModel, name: 'no model selected', modelFileName: null },
      },
    }),
  ]);
  try {
    assert.notEqual(
      start.status,
      400,
      `the shipped devops configuration must not be rejected (${start.raw})`
    );
    assert.notEqual(
      create.status,
      400,
      `a legitimate modelFileName must not be rejected (${create.raw})`
    );
    assert.notEqual(noModel.status, 400, `an absent modelFileName is not hostile (${noModel.raw})`);
    // When a database *is* reachable the containment gate let a real write
    // through, which is the point - assert the stored path is the contained
    // one rather than the raw name.
    if (create.body && create.body.testCase) {
      assert.ok(
        create.body.testCase.modelFileName.endsWith(
          '/data/models/202402-Temperature-Controller.json'
        ),
        `expected a contained model path, got ${create.body.testCase.modelFileName}`
      );
    }
  } finally {
    // Only reachable when a database answered, so this costs nothing in CI.
    // Without one the requests above created nothing to clean up.
    if (start.body && start.body.runningStatus) {
      await request(server.baseUrl, 'GET', '/api/devops/stop');
      removeIfPresent(path.join(campaignLogsDir, start.body.runningStatus.logFile));
    }
    for (const [res, id] of [
      [create, withModel],
      [noModel, withoutModel],
    ]) {
      if (res.body && res.body.testCase) {
        await request(server.baseUrl, 'DELETE', `/api/test-cases/${id}`);
      }
    }
  }
});

// ---------------------------------------------------------------------------
// Hostile names - name allowlist (create/rename) rejects and writes nothing
// ---------------------------------------------------------------------------

test('name sanitisation: creating a model with a hostile name writes no file', async () => {
  const beforeList = await listDir(modelsDir);
  const hostile = ['../../escape', '..%2Fescape', 'a/b', 'a\\b', '..', '.', 'x'.repeat(200)];
  for (const name of hostile) {
    const res = await request(server.baseUrl, 'POST', '/api/models', {
      body: { model: { name, devices: [] } },
    });
    assert.equal(res.status, 400, `expected 400 for name ${JSON.stringify(name)}`);
  }
  // Check every directory a `../` payload actually reaches from the storage
  // root, not just the storage root and the repo root.
  for (const artifact of escapeArtifacts('escape')) {
    assert.ok(!fs.existsSync(artifact), `hostile name must not write ${artifact}`);
  }
  assert.deepEqual(await listDir(modelsDir), beforeList, 'no file written or removed');
});

test('name sanitisation: hostile rename is rejected and leaves the original file', async () => {
  const name = unique('ren');
  const created = await request(server.baseUrl, 'POST', '/api/models', {
    body: { model: { name, devices: [] } },
  });
  assert.equal(created.status, 200);
  const fileName = created.body.modelFileName;
  try {
    const res = await request(server.baseUrl, 'POST', `/api/models/${fileName}`, {
      body: { model: { name: '../../pwned', devices: [] } },
    });
    assert.equal(res.status, 400, 'hostile rename must be rejected');
    assert.ok(fs.existsSync(inModelsDir(fileName)), 'original file must be untouched');
    for (const artifact of escapeArtifacts('pwned')) {
      assert.ok(!fs.existsSync(artifact), `hostile rename must not write ${artifact}`);
    }
  } finally {
    await request(server.baseUrl, 'DELETE', `/api/models/${fileName}`);
  }
});

// ---------------------------------------------------------------------------
// Cross-origin access control
// ---------------------------------------------------------------------------

test('CORS: requests from an unlisted origin are rejected', async () => {
  const res = await request(server.baseUrl, 'GET', '/api/models/', {
    headers: { Origin: hostileOrigin },
  });
  assert.equal(res.status, 403, 'unlisted origin must be rejected');
  assert.equal(res.body.error, 'Origin not allowed');
});

test('CORS: requests from an allowlisted origin are served with an explicit header', async () => {
  const res = await request(server.baseUrl, 'GET', '/api/models/', {
    headers: { Origin: allowedOrigin },
  });
  assert.equal(res.status, 200, 'allowlisted origin must be served');
  assert.equal(res.headers['access-control-allow-origin'], allowedOrigin);
});

test('CORS: same-origin requests are served', async () => {
  const sameOrigin = `http://127.0.0.1:${server.port}`;
  const res = await request(server.baseUrl, 'GET', '/api/models/', {
    headers: { Origin: sameOrigin },
  });
  assert.equal(res.status, 200, 'same-origin request must be served');
});

test('CORS: OPTIONS preflight from an allowed origin is accepted', async () => {
  const res = await request(server.baseUrl, 'OPTIONS', '/api/models/', {
    headers: {
      Origin: allowedOrigin,
      'Access-Control-Request-Method': 'GET',
    },
  });
  assert.equal(res.status, 204, 'preflight from allowed origin must be accepted');
});

// ---------------------------------------------------------------------------
// Legitimate flows - list, read, create, rename, delete a topology
// ---------------------------------------------------------------------------

test('legitimate topology lifecycle: list, read, create, rename, delete', async () => {
  const name = unique('topo');
  assert.equal((await request(server.baseUrl, 'GET', '/api/models/')).status, 200);

  const create = await request(server.baseUrl, 'POST', '/api/models', {
    body: { model: { name, devices: [] } },
  });
  assert.equal(create.status, 200, 'create must succeed');
  const fileName = create.body.modelFileName;
  assert.ok(fileName, 'expected a modelFileName');
  assert.ok(fs.existsSync(inModelsDir(fileName)), 'created file must exist');

  const read = await request(server.baseUrl, 'GET', `/api/models/${fileName}`);
  assert.equal(read.status, 200, 'read must succeed');
  assert.equal(read.body.error, null);
  assert.equal(read.body.model.name, name);

  const renamed = `${name}-renamed`;
  const rename = await request(server.baseUrl, 'POST', `/api/models/${fileName}`, {
    body: { model: { name: renamed, devices: [] } },
  });
  assert.equal(rename.status, 200, 'rename must succeed');
  assert.ok(!fs.existsSync(inModelsDir(fileName)), 'old file must be removed on rename');
  assert.ok(fs.existsSync(inModelsDir(`${renamed}.json`)), 'renamed file must exist');

  const del = await request(server.baseUrl, 'DELETE', `/api/models/${renamed}.json`);
  assert.equal(del.status, 200, 'delete must succeed');
  assert.ok(!fs.existsSync(inModelsDir(`${renamed}.json`)), 'deleted file must be gone');
});
