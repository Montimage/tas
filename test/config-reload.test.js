// Configuration freshness (issue #30): the service configuration used to be
// snapshotted into a module-level variable on first read and never revisited,
// so a configuration change needed a server restart to reach every code path.
// `getDataStorage` now reads through the artifact store on every call, which
// these suites pin down.
//
// No live MongoDB: ENACTDB.prototype.connect is stubbed at the prototype seam
// (the technique of test/data-storage-save.test.js), and the connector points
// at a scratch directory through TAS_DATA_DIR, so no repository file and no
// database is touched.
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const express = require('express');
const { request } = require('./_http');

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tas-config-'));
process.env.TAS_DATA_DIR = dataDir;

const dbcPath = require.resolve('../src/server/routes/db-connector');
const routerPath = require.resolve('../src/server/routes/data-storage');
const enactPath = require.resolve('../src/core/enact-mongoose');

const dataStorageFile = path.join(dataDir, 'data-storage.json');

const storedConfig = {
  protocol: 'MONGODB',
  connConfig: {
    host: 'first-host',
    port: 27017,
    username: null,
    password: null,
    dbname: 'first_db',
    options: null,
  },
};

/**
 * A fresh connector + router pair over the scratch directory.
 *
 * enact-mongoose deliberately stays cached so one prototype patch keeps
 * applying, and the patch is (re)installed on every fresh build: the save
 * path probes connectivity through it before anything is written, and no
 * live database exists here. Patching per build rather than once in a hook
 * keeps the stub in place no matter how the runner orders hooks.
 */
function freshApp() {
  const enact = require(enactPath);
  const originalConnect = enact.ENACTDB.prototype.connect;
  enact.ENACTDB.prototype.connect = function (callback) {
    this.isConnected = true;
    return callback(null);
  };
  after(() => {
    enact.ENACTDB.prototype.connect = originalConnect;
  });
  delete require.cache[dbcPath];
  delete require.cache[routerPath];
  const dataStorageRouter = require(routerPath);
  const app = express();
  app.use(express.json());
  app.use('/api/data-storage', dataStorageRouter);
  return app;
}

after(() => {
  fs.rmSync(dataDir, { recursive: true, force: true });
});

test('a configuration edited behind the running process is served without a restart', async () => {
  fs.writeFileSync(dataStorageFile, JSON.stringify(storedConfig));
  let app = freshApp();
  let server = app.listen(0);

  try {
    const first = await request(server, 'GET', '/api/data-storage');
    assert.equal(first.status, 200);
    assert.equal(first.body.dataStorage.connConfig.host, 'first-host');

    // An external change lands - an operator script, a deploy tool, another
    // process. Nothing in this process is told about it; there is no cache to
    // invalidate and none needed.
    const editedConfig = {
      ...storedConfig,
      connConfig: { ...storedConfig.connConfig, host: 'second-host', dbname: 'second_db' },
    };
    fs.writeFileSync(dataStorageFile, JSON.stringify(editedConfig));

    const second = await request(server, 'GET', '/api/data-storage');
    assert.equal(second.status, 200);
    assert.equal(
      second.body.dataStorage.connConfig.host,
      'second-host',
      'the very next read must serve the new configuration - no restart'
    );
    assert.equal(second.body.dataStorage.connConfig.dbname, 'second_db');
  } finally {
    server.close();
  }
});

test('saving through the API takes effect immediately, including on disk', async () => {
  fs.writeFileSync(dataStorageFile, JSON.stringify(storedConfig));
  const app = freshApp();
  const server = app.listen(0);

  try {
    const updatedConfig = {
      protocol: 'MONGODB',
      connConfig: {
        host: 'api-host',
        port: 27119,
        username: null,
        password: null,
        dbname: 'api_db',
        options: null,
      },
    };
    const saved = await request(server, 'POST', '/api/data-storage', {
      dataStorage: updatedConfig,
    });
    assert.equal(saved.status, 200);
    assert.equal(saved.body.dataStorage.connConfig.host, 'api-host');

    // The response already carries the new configuration, and so does the
    // store - atomically written, complete and parsable.
    const onDisk = JSON.parse(fs.readFileSync(dataStorageFile, 'utf8'));
    assert.equal(onDisk.connConfig.host, 'api-host');

    // And a later read serves it back with no restart anywhere in between.
    const readBack = await request(server, 'GET', '/api/data-storage');
    assert.equal(readBack.body.dataStorage.connConfig.host, 'api-host');
  } finally {
    server.close();
  }
});
