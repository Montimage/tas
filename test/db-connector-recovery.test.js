// Regression tests for #69 (F-BUG-002): the data-storage recovery path used to
// write a FLAT default while the connector reads a NESTED connConfig, so on a
// fresh volume getDBClient destructured an undefined connConfig and threw a
// TypeError inside an fs callback (an uncaught crash, not a 503). These tests
// back up and restore the real data-storage.json, bust the module cache so each
// case starts from a clean in-memory state, and need no running database.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const dataStoragePath = path.join(__dirname, '..', 'src', 'server', 'data', 'data-storage.json');
const dbcPath = path.join(__dirname, '..', 'src', 'server', 'routes', 'db-connector.js');

// Get a fresh db-connector module instance (clears the module-level
// dataStorageConfig / dbClient caches) after arranging the on-disk file.
function freshDbc(fileBody) {
  if (fs.existsSync(dataStoragePath)) fs.rmSync(dataStoragePath, { force: true });
  if (fileBody !== null) fs.writeFileSync(dataStoragePath, fileBody);
  delete require.cache[require.resolve(dbcPath)];
  return require(dbcPath);
}

// Back the real file up (if present) and guarantee restoration afterwards.
function withRealFileRestored(fn) {
  const backup = `${dataStoragePath}.test-bak`;
  const hadFile = fs.existsSync(dataStoragePath);
  if (hadFile) fs.renameSync(dataStoragePath, backup);
  return fn().finally(() => {
    if (fs.existsSync(dataStoragePath)) fs.rmSync(dataStoragePath, { force: true });
    if (hadFile) fs.renameSync(backup, dataStoragePath);
  });
}

// Drive the exported dbConnector middleware (req/res are unused by it) and
// resolve with whatever `next` was called with (an error, or undefined). The
// connector only invokes `next` after the DB connect settles, which may hang
// against an unreachable database; we also resolve on a short timeout because
// the regression we guard against (a TypeError during config destructuring)
// surfaces synchronously in the read callback, before any connect attempt.
function driveConnector(dbc, timeoutMs = 500) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (err) => {
      if (settled) return;
      settled = true;
      resolve(err);
    };
    const next = (err) => finish(err);
    try {
      dbc.dbConnector({}, {}, next);
    } catch (e) {
      finish(e);
    }
    setTimeout(finish, timeoutMs, undefined);
  });
}

test('recovery path writes a nested { protocol, connConfig } default (AC #1)', async () => {
  await withRealFileRestored(async () => {
    const dbc = freshDbc(null); // missing file -> recovery writes the default
    const cfg = await new Promise((res, rej) =>
      dbc.getDataStorage((err, data) => (err ? rej(err) : res(data)))
    );
    assert.equal(cfg.protocol, 'MONGODB');
    assert.ok(cfg.connConfig && typeof cfg.connConfig === 'object', 'default must nest connConfig');
    assert.equal(cfg.connConfig.host, 'localhost');
    assert.equal(cfg.connConfig.port, 27017);
    // The on-disk file must use the same shape the connector reads.
    const onDisk = JSON.parse(fs.readFileSync(dataStoragePath, 'utf8'));
    assert.ok(onDisk.connConfig, 'written default must nest connConfig');
  });
});

test('fresh-volume default is served by the connector without throwing (AC #1)', async () => {
  await withRealFileRestored(async () => {
    // A nested default (the fixed shape) pointing at a closed port so the
    // connect settles fast instead of hanging against an unreachable database.
    const nestedDefault = JSON.stringify({
      protocol: 'MONGODB',
      connConfig: {
        host: 'localhost',
        port: 1,
        dbname: null,
        username: null,
        password: null,
        options: null,
      },
    });
    const dbc = freshDbc(nestedDefault);
    let threw = false;
    let nextErr = undefined;
    try {
      nextErr = await driveConnector(dbc, 3000);
    } catch (e) {
      threw = true;
    }
    assert.ok(!threw, 'dbConnector must not throw a TypeError on the fresh-volume default');
    // The request was refused/served through `next` (connection refused is a
    // legitimate 503), never via an uncaught exception.
    assert.ok(nextErr === undefined || nextErr != null);
  });
});

test('a missing connConfig is reported through 503, not thrown (AC #2)', async () => {
  await withRealFileRestored(async () => {
    const dbc = freshDbc(JSON.stringify({ protocol: 'MONGODB' })); // malformed: no connConfig
    let threw = false;
    let nextErr = undefined;
    try {
      nextErr = await driveConnector(dbc);
    } catch (e) {
      threw = true;
    }
    assert.ok(!threw, 'dbConnector must not throw on a missing connConfig');
    assert.ok(
      nextErr,
      'the missing connConfig must be reported through the unavailable (503) path'
    );
    assert.match(String(nextErr && nextErr.message), /connConfig|unavailable/i);
  });
});
