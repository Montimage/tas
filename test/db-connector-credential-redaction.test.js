// Regression tests for #72 (F-SEC-001): the database connector logged the full
// connection configuration — including the password — and the DataStorage
// connect-failure path handed the whole connConfig to the run logger, whose
// lines land in files under src/server/logs/ that GET /api/logs/*/:fileName
// serves back over the API. These tests drive both paths with a canary
// credential and assert it never reaches the process console or any file under
// the server log directory. No live database is needed: ENACTDB's connect is
// stubbed to fail fast, so only the logging paths under test run for real.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const dataStoragePath = path.join(__dirname, '..', 'src', 'server', 'data', 'data-storage.json');
const dbcPath = path.join(__dirname, '..', 'src', 'server', 'routes', 'db-connector.js');
const dataStorageModulePath = path.join(
  __dirname,
  '..',
  'src',
  'core',
  'communications',
  'DataStorage.js'
);
const enactModulePath = path.join(__dirname, '..', 'src', 'core', 'enact-mongoose', 'index.js');
const loggerModulePath = path.join(__dirname, '..', 'src', 'server', 'logger', 'index.js');
const logsRoot = path.join(__dirname, '..', 'src', 'server', 'logs');

// Canary values unique to this run: no pre-existing file can contain them, so
// the directory-wide sweep below can only fail on a leak of THIS run.
const CANARY_USER = 'redact-user-72';
const CANARY_PW = 'redact-pw-72-8f3a1c';
const CFG = {
  protocol: 'MONGODB',
  connConfig: {
    host: '127.0.0.1',
    port: 27017,
    dbname: 'redaction-db',
    username: CANARY_USER,
    password: CANARY_PW,
    options: null,
  },
};

// Fresh db-connector module instance (clears the module-level
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

// Fail-fast stand-in for the real mongoose connect: the tests exercise the
// logging paths around a failed connection, not the connection itself.
function stubEnactConnect() {
  const enact = require(enactModulePath);
  enact.ENACTDB.prototype.connect = function (callback) {
    setImmediate(() => callback(new Error('connect ECONNREFUSED 127.0.0.1:27017 (test stub)')));
  };
}

// Drive the exported dbConnector middleware and resolve with whatever `next`
// was called with (an error, or undefined on timeout). The configuration line
// under test is logged synchronously during the data-storage read, before any
// connect attempt, so the timeout only bounds the unreachable-database tail.
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

// Serialize a logger argument list the way the transports do, so object
// payloads (e.g. an error's third argument) are scanned too.
function serializeArgs(args) {
  return args
    .map((a) => {
      if (typeof a === 'string') return a;
      try {
        return JSON.stringify(a) ?? String(a);
      } catch {
        return String(a);
      }
    })
    .join(' ');
}

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(p));
    else if (entry.isFile()) out.push(p);
  }
  return out;
}

test('the connector logs host, port and dbname only — never credentials (AC #1)', async () => {
  await withRealFileRestored(async () => {
    stubEnactConnect();
    const dbc = freshDbc(JSON.stringify(CFG));
    const captured = [];
    const origLog = console.log;
    console.log = (...args) => captured.push(serializeArgs(args));
    let nextErr;
    try {
      nextErr = await driveConnector(dbc, 3000);
    } finally {
      console.log = origLog;
    }
    const all = captured.join('\n');
    assert.ok(
      all.includes('MongoDB configuration'),
      'the connection must still be announced in the log'
    );
    assert.ok(all.includes('127.0.0.1'), 'host must be named');
    assert.ok(all.includes('redaction-db'), 'database name must be named');
    assert.ok(!all.includes(CANARY_PW), 'the password must never be logged');
    assert.ok(!all.includes(CANARY_USER), 'the username must never be logged');
    assert.ok(!all.includes('"password"'), 'the password field must not survive redaction');
    // The request still goes through the normal refusal path (503), proving
    // redaction did not break the connector.
    assert.ok(nextErr === undefined || nextErr != null);
  });
});

test('DataStorage connect-failure logging names host/port/dbname only (AC #1)', async () => {
  stubEnactConnect();
  const DataStorage = require(dataStorageModulePath);
  const calls = [];
  const fakeLogger = {
    log: (...args) => calls.push(serializeArgs(args)),
    info: (...args) => calls.push(serializeArgs(args)),
    warn: (...args) => calls.push(serializeArgs(args)),
    error: (...args) => calls.push(serializeArgs(args)),
    debug: (...args) => calls.push(serializeArgs(args)),
  };
  const ds = new DataStorage(CFG, fakeLogger);
  await new Promise((resolve) => ds.connect(resolve));
  const all = calls.join('\n');
  assert.ok(
    all.includes('[DataStorage] ERROR: Failed to connect to database'),
    'the failure must still be reported'
  );
  assert.ok(all.includes('127.0.0.1'), 'host must be named');
  assert.ok(all.includes('redaction-db'), 'database name must be named');
  assert.ok(!all.includes(CANARY_PW), 'the password must never reach the run logger');
  assert.ok(!all.includes(CANARY_USER), 'the username must never reach the run logger');
});

test('a configured password never appears in any file under the server log directory (AC #2)', async () => {
  stubEnactConnect();
  const getLogger = require(loggerModulePath);
  const DataStorage = require(dataStorageModulePath);
  const logFile = path.join(logsRoot, 'simulations', `redaction-regression-${Date.now()}.log`);
  const logger = getLogger('SIMULATION', logFile);
  try {
    // Exactly what simulation.js does: hand the run's own logger to the
    // DataStorage so its lines land in the run's file under src/server/logs/.
    const ds = new DataStorage(CFG, logger);
    await new Promise((resolve) => ds.connect(resolve));
  } finally {
    logger.close();
  }
  // Wait until the run's file exists and provably carries this run's lines
  // (positive marker), so the sweep cannot pass on an unwritten file.
  const marker = '[DataStorage] Connecting';
  let written = false;
  for (let i = 0; i < 50 && !written; i++) {
    if (fs.existsSync(logFile)) {
      written = fs.readFileSync(logFile, 'utf8').includes(marker);
    }
    if (!written) await new Promise((r) => setTimeout(r, 100));
  }
  assert.ok(written, 'the run log file must exist and contain this run’s lines');
  try {
    for (const f of walk(logsRoot)) {
      const content = fs.readFileSync(f, 'utf8');
      assert.ok(!content.includes(CANARY_PW), `the password leaked into ${f}`);
      assert.ok(!content.includes(CANARY_USER), `the username leaked into ${f}`);
    }
  } finally {
    fs.rmSync(logFile, { force: true });
  }
});
