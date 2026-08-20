const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const { request } = require('./_http');

const modelRouter = require('../src/server/routes/model');
const dataRecorderRouter = require('../src/server/routes/data-recorders');
const simulationRouter = require('../src/server/routes/simulation');
const createLogRouter = require('../src/server/routes/logs');
const devopsRouter = require('../src/server/routes/devops');
const testCasesRouter = require('../src/server/routes/test-cases');

const modelsDir = path.resolve(__dirname, '../src/server/data/models');
const dataRecordersDir = path.resolve(__dirname, '../src/server/data/data-recorders');
const repoPackageJson = path.resolve(__dirname, '../package.json');
const devopsFile = path.resolve(__dirname, '../src/server/data/devops.json');
const srcDir = path.resolve(__dirname, '../src');

let server;
let app;
let originalDevops;

before(() => {
  // These tests exercise the write path of POST /api/devops, which overwrites
  // the shipped configuration. Snapshot it so the checkout is left unchanged.
  originalDevops = fs.readFileSync(devopsFile, 'utf8');
  app = express();
  app.use(express.json());
  app.use('/api/models', modelRouter);
  app.use('/api/data-recorders', dataRecorderRouter);
  app.use('/api/simulation', simulationRouter);
  app.use('/api/logs/simulations', createLogRouter('simulations'));
  app.use('/api/devops', devopsRouter);
  app.use('/api/test-cases', testCasesRouter);
  server = app.listen(0);
});

after(() => {
  server.close();
  // Guarded: if the snapshot itself failed, restoring would mask the real error.
  if (originalDevops !== undefined) fs.writeFileSync(devopsFile, originalDevops);
});

const unique = (prefix) => `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const inModelsDir = (fileName) => path.join(modelsDir, fileName);
const inRecordersDir = (fileName) => path.join(dataRecordersDir, fileName);

// ---------------------------------------------------------------------------
// Issue #1 — containment of URL-parameterised filesystem access
// ---------------------------------------------------------------------------

test('models GET rejects traversal and does not disclose server paths', async () => {
  const attempts = [
    '/api/models/..%2Fpackage.json',
    '/api/models/%2e%2e%2fpackage.json',
    '/api/models/..%2F..%2F..%2Fetc%2Fpasswd',
  ];
  for (const p of attempts) {
    const res = await request(server, 'GET', p);
    assert.equal(res.status, 400, `expected 400 for ${p}, got ${res.status} (${res.raw})`);
    assert.ok(!res.raw.includes('/home/'), `response must not leak server paths: ${res.raw}`);
    assert.ok(!res.raw.includes('workspace'), `response must not leak server paths: ${res.raw}`);
    assert.ok(!res.raw.includes('package.json'), `response must not leak the target: ${res.raw}`);
  }
});

test('models GET serves a legitimate model unchanged', async () => {
  const res = await request(server, 'GET', '/api/models/202402-Temperature-Controller.json');
  assert.equal(res.status, 200);
  assert.equal(res.body.error, null);
  assert.ok(res.body.model);
  assert.equal(res.body.model.name, 'Temperature-Controller');
});

test('models DELETE rejects traversal and does not delete outside files', async () => {
  assert.ok(fs.existsSync(repoPackageJson));
  const res = await request(server, 'DELETE', '/api/models/..%2Fpackage.json');
  assert.equal(res.status, 400);
  assert.ok(fs.existsSync(repoPackageJson), 'package.json must not be deleted');
});

test('models DELETE rejects URL-encoded separator traversal', async () => {
  const res = await request(server, 'DELETE', '/api/models/%2e%2e%2fpackage.json');
  assert.equal(res.status, 400);
  assert.ok(fs.existsSync(repoPackageJson), 'package.json must not be deleted');
});

test('data-recorders GET rejects traversal', async () => {
  const res = await request(server, 'GET', '/api/data-recorders/models/..%2Fpackage.json');
  assert.equal(res.status, 400);
  assert.ok(!res.raw.includes('workspace'));
});

test('data-recorders GET serves a legitimate recorder unchanged', async () => {
  const res = await request(
    server,
    'GET',
    '/api/data-recorders/models/TemperatureControllerRecorder.json'
  );
  assert.equal(res.status, 200);
  assert.ok(res.body.dataRecorder);
  assert.equal(res.body.dataRecorder.name, 'Temperature Controller Recorder');
});

test('data-recorders DELETE rejects traversal and does not delete outside files', async () => {
  const res = await request(server, 'DELETE', '/api/data-recorders/models/..%2Fpackage.json');
  assert.equal(res.status, 400);
  assert.ok(fs.existsSync(repoPackageJson), 'package.json must not be deleted');
});

test('logs GET rejects traversal and does not disclose server paths', async () => {
  const res = await request(server, 'GET', '/api/logs/simulations/..%2Fpackage.json');
  assert.equal(res.status, 400);
  assert.ok(!res.raw.includes('workspace'));
  assert.ok(!res.raw.includes('package.json'));
});

test('logs DELETE rejects traversal and does not delete outside files', async () => {
  const res = await request(server, 'DELETE', '/api/logs/simulations/..%2Fpackage.json');
  assert.equal(res.status, 400);
  assert.ok(fs.existsSync(repoPackageJson), 'package.json must not be deleted');
});

test('simulation POST /start rejects traversal in body modelFileName', async () => {
  const res = await request(server, 'POST', '/api/simulation/start', {
    modelFileName: '..%2Fpackage.json',
  });
  assert.equal(res.status, 400);
  assert.ok(fs.existsSync(repoPackageJson));
});

test('data-recorders POST /start rejects traversal in body dataRecorderFileName', async () => {
  const res = await request(server, 'POST', '/api/data-recorders/start', {
    dataRecorderFileName: '../../package.json',
  });
  assert.equal(res.status, 400);
  assert.ok(fs.existsSync(repoPackageJson));
});

// ---------------------------------------------------------------------------
// Issue #2 — sanitise user-supplied names before deriving storage filenames
// ---------------------------------------------------------------------------

test('models POST rejects hostile names and creates no file', async () => {
  const hostile = ['../../escape', '..%2F..%2Fescape', 'a/b', 'a\\b', 'x'.repeat(200), '.', '..'];
  for (const name of hostile) {
    const res = await request(server, 'POST', '/api/models', {
      model: { name, devices: [] },
    });
    assert.equal(res.status, 400, `expected 400 for name ${JSON.stringify(name)}`);
  }
  assert.ok(!fs.existsSync(path.resolve(__dirname, '../escape.json')));
  assert.ok(!fs.existsSync(inModelsDir('escape.json')));
  assert.ok(!fs.existsSync(path.resolve(__dirname, '../../escape.json')));
});

test('models create, read, rename and delete with valid names', async () => {
  const name = unique('sec-model');
  const create = await request(server, 'POST', '/api/models', {
    model: { name, devices: [] },
  });
  assert.equal(create.status, 200);
  const fileName = create.body.modelFileName;
  assert.ok(fileName, 'expected a modelFileName');
  assert.ok(fs.existsSync(inModelsDir(fileName)));

  const read = await request(server, 'GET', `/api/models/${fileName}`);
  assert.equal(read.status, 200);
  assert.equal(read.body.model.name, name);

  const renamed = `${name}-renamed`;
  const rename = await request(server, 'POST', `/api/models/${fileName}`, {
    model: { name: renamed, devices: [] },
  });
  assert.equal(rename.status, 200);
  assert.ok(!fs.existsSync(inModelsDir(fileName)), 'old file must be removed on rename');
  assert.ok(fs.existsSync(inModelsDir(`${renamed}.json`)), 'renamed file must exist');

  const del = await request(server, 'DELETE', `/api/models/${renamed}.json`);
  assert.equal(del.status, 200);
  assert.ok(!fs.existsSync(inModelsDir(`${renamed}.json`)));
});

test('models POST duplicate produces a readable duplicated name', async () => {
  const name = unique('sec-dup');
  const create = await request(server, 'POST', '/api/models', {
    model: { name, devices: [] },
  });
  assert.equal(create.status, 200);
  const fileName = create.body.modelFileName;
  try {
    const dup = await request(server, 'POST', `/api/models/${fileName}`, {
      isDuplicated: true,
    });
    assert.equal(dup.status, 200);
    const dupFileName = dup.body.modelFileName;
    assert.ok(dupFileName.includes('[Duplicated]'), `expected [Duplicated] in ${dupFileName}`);
    assert.ok(fs.existsSync(inModelsDir(dupFileName)));
    await request(server, 'DELETE', `/api/models/${encodeURIComponent(dupFileName)}`);
  } finally {
    await request(server, 'DELETE', `/api/models/${fileName}`);
  }
});

test('models rename with a hostile new name is rejected and removes nothing', async () => {
  const name = unique('sec-rename');
  const create = await request(server, 'POST', '/api/models', {
    model: { name, devices: [] },
  });
  assert.equal(create.status, 200);
  const fileName = create.body.modelFileName;
  try {
    const res = await request(server, 'POST', `/api/models/${fileName}`, {
      model: { name: '../../pwned', devices: [] },
    });
    assert.equal(res.status, 400);
    assert.ok(fs.existsSync(inModelsDir(fileName)), 'original file must be untouched');
    assert.ok(!fs.existsSync(path.resolve(__dirname, '../../pwned.json')));
    assert.ok(!fs.existsSync(inModelsDir('pwned.json')));
  } finally {
    await request(server, 'DELETE', `/api/models/${fileName}`);
  }
});

test('data-recorders POST /models rejects hostile names and creates no file', async () => {
  const hostile = ['../../escape', 'a/b', 'x'.repeat(200)];
  for (const name of hostile) {
    const res = await request(server, 'POST', '/api/data-recorders/models', {
      dataRecorder: { name, dataRecorders: [] },
    });
    assert.equal(res.status, 400, `expected 400 for name ${JSON.stringify(name)}`);
  }
  assert.ok(!fs.existsSync(inRecordersDir('escape.json')));
});

test('data-recorders create and delete with valid names', async () => {
  const name = unique('sec-dr');
  const create = await request(server, 'POST', '/api/data-recorders/models', {
    dataRecorder: { name, dataRecorders: [] },
  });
  assert.equal(create.status, 200);
  const fileName = create.body.dataRecorderFileName;
  assert.ok(fs.existsSync(inRecordersDir(fileName)));

  const del = await request(server, 'DELETE', `/api/data-recorders/models/${fileName}`);
  assert.equal(del.status, 200);
  assert.ok(!fs.existsSync(inRecordersDir(fileName)));
});

test('data-recorders rename with hostile new name is rejected and removes nothing', async () => {
  const name = unique('sec-dr-rename');
  const create = await request(server, 'POST', '/api/data-recorders/models', {
    dataRecorder: { name, dataRecorders: [] },
  });
  assert.equal(create.status, 200);
  const fileName = create.body.dataRecorderFileName;
  try {
    const res = await request(server, 'POST', `/api/data-recorders/models/${fileName}`, {
      dataRecorder: { name: '../../pwned', dataRecorders: [] },
    });
    assert.equal(res.status, 400);
    assert.ok(fs.existsSync(inRecordersDir(fileName)), 'original file must be untouched');
    assert.ok(!fs.existsSync(inRecordersDir('pwned.json')));
  } finally {
    await request(server, 'DELETE', `/api/data-recorders/models/${fileName}`);
  }
});

test('data-recorders start rejects a hostile model name in the body', async () => {
  const res = await request(server, 'POST', '/api/data-recorders/start', {
    model: { name: '../../pwned', dataRecorders: [] },
  });
  assert.equal(res.status, 400);
});

test('simulation start rejects a hostile topology name in the body', async () => {
  const res = await request(server, 'POST', '/api/simulation/start', {
    model: { name: '../../pwned', devices: [] },
  });
  assert.equal(res.status, 400);
});

// ---------------------------------------------------------------------------
// Issue #55 — the remaining name-derived paths (devops, test-cases)
//
// Both sinks sit behind `dbConnector`. The containment guards deliberately run
// *ahead* of it, so every rejection below returns without a database round
// trip — that is what makes them assertable here with no MongoDB running.
// ---------------------------------------------------------------------------

/** Names that must never be usable to derive a filesystem path. */
const hostileNames = [
  '../../pwned',
  '../../../../etc/passwd',
  '..%2F..%2Fpwned',
  'a/b',
  'a\\b',
  '..',
  '.',
  'x'.repeat(200),
];

test('devops POST rejects a hostile testCampaignId and persists nothing', async () => {
  for (const testCampaignId of hostileNames) {
    const res = await request(server, 'POST', '/api/devops', {
      devops: { webhookURL: 'http://localhost:3333/webhook', testCampaignId },
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
    fs.readFileSync(devopsFile, 'utf8'),
    originalDevops,
    'a rejected configuration must never be written to disk'
  );
});

test('devops POST rejects a non-string testCampaignId', async () => {
  for (const testCampaignId of [42, { $ne: null }, ['a'], true]) {
    const res = await request(server, 'POST', '/api/devops', {
      devops: { testCampaignId },
    });
    assert.equal(
      res.status,
      400,
      `expected 400 for testCampaignId ${JSON.stringify(testCampaignId)}`
    );
  }
  assert.equal(fs.readFileSync(devopsFile, 'utf8'), originalDevops);
});

test('devops POST accepts a legitimate configuration unchanged', async () => {
  const devops = JSON.parse(originalDevops);
  const res = await request(server, 'POST', '/api/devops', { devops });
  assert.equal(res.status, 200, `legitimate configuration must be saved (${res.raw})`);
  assert.equal(res.body.devops.testCampaignId, devops.testCampaignId);
  assert.deepEqual(JSON.parse(fs.readFileSync(devopsFile, 'utf8')), devops);
});

test('devops POST accepts a configuration with no testCampaignId', async () => {
  const res = await request(server, 'POST', '/api/devops', {
    devops: { webhookURL: 'http://localhost:3333/webhook' },
  });
  assert.equal(res.status, 200, `an absent id is not hostile (${res.raw})`);
  // Restore the shipped configuration for the tests that follow.
  await request(server, 'POST', '/api/devops', { devops: JSON.parse(originalDevops) });
});

test('devops GET /start rejects a hostile testCampaignId already on disk', async () => {
  const hostileId = '../../../pwned';
  fs.writeFileSync(
    devopsFile,
    JSON.stringify({ webhookURL: 'http://localhost:3333/webhook', testCampaignId: hostileId })
  );
  // A configuration written by an older build is only seen by a process that
  // has not cached one yet, so this needs a router with a cold config cache.
  const modulePath = require.resolve('../src/server/routes/devops');
  delete require.cache[modulePath];
  const coldApp = express();
  coldApp.use(express.json());
  coldApp.use('/api/devops', require(modulePath));
  const coldServer = coldApp.listen(0);
  try {
    const res = await request(coldServer, 'GET', '/api/devops/start');
    assert.equal(res.status, 400, `persisted hostile id must be rejected (${res.raw})`);
    assert.ok(!res.raw.includes('/home/'), `must not leak server paths: ${res.raw}`);
    assert.ok(!res.raw.includes('workspace'), `must not leak server paths: ${res.raw}`);
    // `../../../` from src/server/logs/test-campaigns/ lands in src/, and the
    // logger creates missing parent directories, so this is a real write.
    assert.deepEqual(
      fs.readdirSync(srcDir).filter((f) => f.startsWith('pwned')),
      [],
      'no log file may be written outside the test-campaign log root'
    );
  } finally {
    coldServer.close();
    fs.writeFileSync(devopsFile, originalDevops);
    delete require.cache[modulePath];
  }
});

test('devops GET does not disclose the config path when it cannot be read', async () => {
  // A Node fs error carries the absolute path of the file it failed to open in
  // its own enumerable properties, so echoing it back leaks the server layout.
  // Reaching that branch needs both an unreadable file and a router that has
  // not cached a configuration yet, hence the same cold-cache router as above.
  // The file is put back in `finally`, and the suite-wide `after` hook restores
  // it again from the same snapshot, so a mid-test failure cannot cost the
  // checkout its devops.json.
  fs.unlinkSync(devopsFile);
  const modulePath = require.resolve('../src/server/routes/devops');
  delete require.cache[modulePath];
  const coldApp = express();
  coldApp.use(express.json());
  coldApp.use('/api/devops', require(modulePath));
  const coldServer = coldApp.listen(0);
  try {
    const res = await request(coldServer, 'GET', '/api/devops');
    assert.equal(
      res.body.error,
      'Cannot get devops configuration',
      `an unreadable configuration must report a constant message (${res.raw})`
    );
    assert.ok(!res.raw.includes('/home/'), `must not leak server paths: ${res.raw}`);
    assert.ok(!res.raw.includes('workspace'), `must not leak server paths: ${res.raw}`);
    assert.ok(!res.raw.includes('devops.json'), `must not leak the config path: ${res.raw}`);
  } finally {
    coldServer.close();
    fs.writeFileSync(devopsFile, originalDevops);
    delete require.cache[modulePath];
  }
});

test('test-cases POST rejects a hostile modelFileName and never reaches the database', async () => {
  const hostile = [
    '../../../package.json',
    '../package.json',
    '/etc/passwd',
    'a/../../../package.json',
    '..%2Fpackage.json',
  ];
  for (const modelFileName of hostile) {
    const res = await request(server, 'POST', '/api/test-cases', {
      testCase: { id: unique('tc'), name: 'tc', modelFileName },
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

test('test-cases POST /:testCaseId rejects a hostile modelFileName', async () => {
  const res = await request(server, 'POST', '/api/test-cases/any-id', {
    testCase: { modelFileName: '../../../package.json' },
  });
  assert.equal(
    res.status,
    400,
    `the update path must not be a way around the create-time check (${res.raw})`
  );
  assert.ok(fs.existsSync(repoPackageJson));
});

test('test-cases POST /:testCaseId rejects a MongoDB update operator', async () => {
  // Without this the containment is bypassable in one request: an operator
  // document carries no own `modelFileName` key, so a check that only looks at
  // plain fields waves it through and mongoose casts it to the database intact.
  const hostile = [
    { $set: { modelFileName: '/etc/passwd' } },
    { $set: { modelFileName: '../../../package.json' } },
    { $setOnInsert: { modelFileName: '/etc/passwd' } },
    { $unset: { modelFileName: '' } },
  ];
  for (const testCase of hostile) {
    const res = await request(server, 'POST', '/api/test-cases/any-id', { testCase });
    assert.equal(
      res.status,
      400,
      `expected 400 for ${JSON.stringify(testCase)}, got ${res.status} (${res.raw})`
    );
    assert.ok(!res.raw.includes('/home/'), `must not leak server paths: ${res.raw}`);
    assert.ok(!res.raw.includes('workspace'), `must not leak server paths: ${res.raw}`);
  }
  assert.ok(fs.existsSync(repoPackageJson), 'canary must be untouched');
});

test('test-cases POST rejects a MongoDB update operator', async () => {
  const res = await request(server, 'POST', '/api/test-cases', {
    testCase: { $set: { modelFileName: '/etc/passwd' } },
  });
  assert.equal(res.status, 400, `expected 400, got ${res.status} (${res.raw})`);
});

test('test-cases POST rejects a non-string modelFileName', async () => {
  for (const modelFileName of [42, { $ne: null }, ['../../x']]) {
    const res = await request(server, 'POST', '/api/test-cases', {
      testCase: { id: unique('tc'), modelFileName },
    });
    assert.equal(
      res.status,
      400,
      `expected 400 for modelFileName ${JSON.stringify(modelFileName)}`
    );
  }
});

// The rejection tests above all return before `dbConnector`, but the value the
// guard *stores* on the way through only reaches an assertion when a database
// answers - which CI has none of. Exercise the middleware on its own so a guard
// that contained the wrong path cannot pass unnoticed. It is taken off the
// router's own stack rather than re-exported, so the test binds to the exact
// function the create and update routes run. It is found by name rather than by
// position, so adding middleware ahead of it (input validation, say) cannot
// silently point this test at a different function.
const containModelFileName = testCasesRouter.stack
  .find((layer) => layer.route && layer.route.path === '/' && layer.route.methods.post)
  .route.stack.map((layer) => layer.handle)
  .find((handle) => handle.name === 'containModelFileName');

test('test-cases containment stores the resolved path inside the models directory', async () => {
  const guardApp = express();
  guardApp.use(express.json());
  guardApp.post('/contain', containModelFileName, (req, res) => {
    // `undefined` is JSON-dropped, so report the raw state explicitly.
    res.send({
      contained:
        req.containedModelFileName === undefined ? 'undefined' : req.containedModelFileName,
    });
  });
  const guardServer = guardApp.listen(0);
  try {
    const legitimate = await request(guardServer, 'POST', '/contain', {
      testCase: { modelFileName: '202402-Temperature-Controller.json' },
    });
    assert.equal(legitimate.status, 200, legitimate.raw);
    assert.equal(
      legitimate.body.contained,
      inModelsDir('202402-Temperature-Controller.json'),
      'a legitimate name must be stored as its resolved path in the models directory'
    );

    // An explicitly empty name is a caller asking for "no model", which is
    // stored as null rather than a path to a file that cannot exist.
    for (const modelFileName of [null, '']) {
      const res = await request(guardServer, 'POST', '/contain', {
        testCase: { modelFileName },
      });
      assert.equal(res.status, 200, res.raw);
      assert.equal(
        res.body.contained,
        null,
        `expected null for modelFileName ${JSON.stringify(modelFileName)}`
      );
    }

    // A payload that carries no modelFileName at all leaves the value unset,
    // which is what tells the update route to leave the stored one alone.
    const absent = await request(guardServer, 'POST', '/contain', {
      testCase: { name: 'no model field' },
    });
    assert.equal(absent.status, 200, absent.raw);
    assert.equal(absent.body.contained, 'undefined');
  } finally {
    guardServer.close();
  }
});
