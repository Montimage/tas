// Saving a data-storage configuration that cannot connect must be refused,
// not reported as success (issue #18).
//
// updateDataStorage used to persist the proposed configuration first and probe
// its connection afterwards, in a branch that inspected the wrong error value
// and referenced an out-of-scope `res`; repaired to log-only by #61, master
// kept answering 200 for an unreachable database while leaving the previously
// working configuration overwritten on disk. The save path now verifies the
// configuration through the same seam the dashboard's Test Connection uses
// (`buildConnectedClient`) before anything is written.
//
// No live MongoDB: ENACTDB.prototype.connect is stubbed at the prototype seam
// - the same technique test/data-storage.test.js uses - keyed by port so one
// suite can mix reachable and unreachable targets. The full route pipeline
// runs for real (validation, handler, shared error handler), and the real
// data-storage.json is backed up and restored around the whole file, following
// test/db-connector-recovery.test.js.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const { request } = require('./_http');

const dataStoragePath = path.join(__dirname, '..', 'src', 'server', 'data', 'data-storage.json');
const dbcPath = require.resolve('../src/server/routes/db-connector');
const routerPath = require.resolve('../src/server/routes/data-storage');
const enactPath = require.resolve('../src/core/enact-mongoose');

const SECRET = 'sup3r-secret-password';

const workingConfig = {
  protocol: 'MONGODB',
  connConfig: {
    host: 'oldhost',
    port: 27017,
    username: null,
    password: null,
    dbname: 'olddb',
    options: null,
  },
};

const brokenConfig = {
  protocol: 'MONGODB',
  connConfig: {
    host: 'unreachable',
    port: 59999,
    username: 'writer',
    password: SECRET,
    dbname: 'tas_db',
    options: null,
  },
};

const otherWorkingConfig = {
  protocol: 'MONGODB',
  connConfig: {
    host: 'newhost',
    port: 27118,
    username: null,
    password: null,
    dbname: 'newdb',
    options: null,
  },
};

// Every ENACTDB construction the code under test performs is recorded here so
// tests can pin how often the verification seam runs and with what settings.
let built;
let connectImpl;

/** Install a prototype stub answering per-config via connectImpl. */
function stubConnect() {
  const enact = require(enactPath);
  built = [];
  enact.ENACTDB.prototype.connect = function (callback) {
    built.push({ host: this.host, port: this.port, dbName: this.dbName });
    return connectImpl.call(this, callback);
  };
}

/**
 * Arrange the on-disk configuration, reset the connector's module state, and
 * mount a fresh data-storage router. The connector and the router are both
 * re-required so the router binds the fresh module's functions; enact-mongoose
 * deliberately stays cached so the prototype stub keeps applying.
 */
function freshApp(fileBody) {
  if (fs.existsSync(dataStoragePath)) fs.rmSync(dataStoragePath, { force: true });
  if (fileBody !== null && fileBody !== undefined) {
    fs.writeFileSync(dataStoragePath, JSON.stringify(fileBody));
  }
  delete require.cache[dbcPath];
  delete require.cache[routerPath];
  stubConnect();
  const dataStorageRouter = require(routerPath);
  const app = express();
  app.use(express.json());
  app.use('/api/data-storage', dataStorageRouter);
  return app;
}

/** Default stub behaviour: port 27017 connects, everything else refuses. */
function refuseExcept(portThatWorks) {
  return function (callback) {
    if (this.port === portThatWorks) {
      this.isConnected = true;
      return callback(null);
    }
    return callback(new Error(`connect ECONNREFUSED ${this.host}:${this.port}`));
  };
}

let server;

before(() => {
  // Back the real file up once; every test arranges its own state through
  // freshApp, and after() guarantees restoration even on failure.
  const backup = `${dataStoragePath}.test-bak`;
  if (fs.existsSync(dataStoragePath)) fs.renameSync(dataStoragePath, backup);
  server = freshApp(workingConfig).listen(0);
});

after(() => {
  if (server) server.close();
  if (fs.existsSync(dataStoragePath)) fs.rmSync(dataStoragePath, { force: true });
  const backup = `${dataStoragePath}.test-bak`;
  if (fs.existsSync(backup)) fs.renameSync(backup, dataStoragePath);
});

/** Assert a failure body is exactly the central handler's shape. */
const assertErrorShape = (res, status, context) => {
  assert.equal(res.status, status, `${context}: expected ${status}, got ${res.status}`);
  assert.ok(res.body, `${context} must answer with a JSON body (${res.raw})`);
  assert.equal(typeof res.body.error, 'string', `${context} must carry a string error`);
  assert.deepEqual(
    Object.keys(res.body).filter((key) => key !== 'error' && key !== 'details'),
    [],
    `${context}: an error body carries nothing but error and details (${res.raw})`
  );
};

test('saving a configuration that cannot connect returns 503, never success (AC1)', async () => {
  server.close();
  server = freshApp(workingConfig).listen(0);
  connectImpl = refuseExcept(27017);

  const res = await request(server, 'POST', '/api/data-storage', { dataStorage: brokenConfig });
  assertErrorShape(res, 503, 'POST of an unreachable configuration');
  assert.match(res.body.error, /cannot connect/i);
  // Success must not leak sideways through the body either.
  assert.equal(res.body.dataStorage, undefined);
});

test('the failure names what happened without leaking credentials (AC2)', async () => {
  server.close();
  server = freshApp(workingConfig).listen(0);
  connectImpl = refuseExcept(27017);

  const res = await request(server, 'POST', '/api/data-storage', { dataStorage: brokenConfig });
  assert.equal(res.status, 503);
  assert.ok(!res.raw.includes(SECRET), `the password must never reach the response (${res.raw})`);
  assert.ok(
    !res.raw.includes(brokenConfig.connConfig.username),
    'the username must never reach the response'
  );
  assert.match(
    res.body.error,
    /data storage not updated/i,
    'the message must say the save did not happen'
  );
});

test('a failed save leaves the previously working configuration on disk (AC3)', async () => {
  server.close();
  const arranged = JSON.parse(JSON.stringify(workingConfig));
  server = freshApp(arranged).listen(0);
  connectImpl = refuseExcept(27017);

  const res = await request(server, 'POST', '/api/data-storage', { dataStorage: brokenConfig });
  assert.equal(res.status, 503);

  const onDisk = JSON.parse(fs.readFileSync(dataStoragePath, 'utf8'));
  assert.deepEqual(onDisk, arranged, 'disk must still hold the previous configuration');
});

test('a failed save leaves the served configuration untouched in memory (AC3)', async () => {
  server.close();
  server = freshApp(workingConfig).listen(0);
  connectImpl = refuseExcept(27017);

  await request(server, 'POST', '/api/data-storage', { dataStorage: brokenConfig });

  const res = await request(server, 'GET', '/api/data-storage');
  assert.equal(res.status, 200, `GET must still serve (${res.raw})`);
  assert.deepEqual(res.body.dataStorage, workingConfig, 'the old configuration must be served');
});

test('after a failed save the connection test reconnects the previous configuration (AC3, AC5)', async () => {
  server.close();
  server = freshApp(workingConfig).listen(0);
  connectImpl = refuseExcept(27017);

  const failed = await request(server, 'POST', '/api/data-storage', {
    dataStorage: brokenConfig,
  });
  assert.equal(failed.status, 503);
  const postSaveBuilds = built.length;

  // The refused save cleared the live client; the next verification must
  // lazily rebuild from the untouched previous configuration — the same
  // `buildConnectedClient` seam, reached through GET /test.
  const res = await request(server, 'GET', '/api/data-storage/test');
  assert.equal(res.status, 200, `the previous configuration must still work (${res.raw})`);
  assert.equal(res.body.connectionStatus, true);
  assert.deepEqual(
    built.slice(postSaveBuilds),
    [{ host: 'oldhost', port: 27017, dbName: 'olddb' }],
    'the reconnect must use the previous settings, not the refused ones'
  );
});

test('saving a valid configuration succeeds and takes effect without a restart (AC4)', async () => {
  server.close();
  server = freshApp(workingConfig).listen(0);
  connectImpl = refuseExcept(27118);

  const res = await request(server, 'POST', '/api/data-storage', {
    dataStorage: otherWorkingConfig,
  });
  assert.equal(res.status, 200, `a verifiable configuration must save (${res.raw})`);
  assert.deepEqual(res.body.dataStorage, otherWorkingConfig);

  const onDisk = JSON.parse(fs.readFileSync(dataStoragePath, 'utf8'));
  assert.deepEqual(onDisk, otherWorkingConfig, 'the new configuration must be persisted');

  // Served from the committed in-memory state — no restart involved.
  const served = await request(server, 'GET', '/api/data-storage');
  assert.deepEqual(served.body.dataStorage, otherWorkingConfig);

  // Verify-then-commit probes exactly once and promotes that verified client,
  // so the connection test afterwards finds it already live.
  assert.deepEqual(built, [{ host: 'newhost', port: 27118, dbName: 'newdb' }]);
  const testRes = await request(server, 'GET', '/api/data-storage/test');
  assert.equal(testRes.status, 200, `the promoted client must answer (${testRes.raw})`);
  assert.equal(built.length, 1, 'an already-live client must not be rebuilt');
});

test('connection test and save share one verification seam (AC5)', async () => {
  server.close();
  server = freshApp(workingConfig).listen(0);
  connectImpl = refuseExcept(-1); // nothing connects: both actions must fail alike

  const testRes = await request(server, 'GET', '/api/data-storage/test');
  assert.equal(testRes.status, 503, 'Test Connection must report unreachability');
  const afterTest = built.length;
  assert.ok(afterTest > 0, 'the connection test must have probed the seam');

  const saveRes = await request(server, 'POST', '/api/data-storage', {
    dataStorage: brokenConfig,
  });
  assert.equal(saveRes.status, 503, 'Save must report unreachability just like the test action');
  assert.ok(built.length > afterTest, 'the save must have probed the very same seam');
});

test('a malformed configuration reaches the error branch instead of throwing (F-BUG-002 seam)', async () => {
  server.close();
  server = freshApp(workingConfig).listen(0);
  connectImpl = refuseExcept(27017);

  // The route cannot send this (Joi refuses it first), but updateDataStorage
  // is module API: a null configuration must be reported through its callback,
  // never thrown synchronously inside an fs/connect callback.
  const dbc = require(dbcPath);
  await new Promise((resolve) => {
    dbc.updateDataStorage(null, (err) => {
      assert.ok(err, 'null configuration must be reported through the callback');
      resolve();
    });
  });
  assert.deepEqual(
    JSON.parse(fs.readFileSync(dataStoragePath, 'utf8')),
    workingConfig,
    'disk must be untouched by a refused configuration'
  );
});
