/**
 * Restart and multi-process behaviour of the runtime-state registry (issue #29).
 *
 * These tests drive REAL, separately spawned server instances over HTTP and
 * assert what cannot be proven by inspection: running work is recorded
 * outside process memory, so a restart reports the true running state and
 * work orphaned by an unclean shutdown is detected and cleaned up; two
 * processes sharing one store observe the same view of what is running.
 *
 * Nothing here needs a broker or a database: every run declares no devices
 * and an explicit (never-contacted) data storage, so registration takes the
 * synchronous path.
 */
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { startServer, request, unique } = require('./helpers');

/** A ceiling high enough that no test in this file trips the limiter. */
const NO_RATE_LIMIT = '100000';

/** A schema-valid data-storage configuration that is never contacted. */
const storageConfig = () => ({
  protocol: 'MONGODB',
  connConfig: {
    host: '127.0.0.1',
    port: 1,
    username: null,
    password: null,
    dbname: null,
    options: null,
  },
});

const emptyModel = (name) => ({ name, devices: [] });

let storeDir;

before(() => {
  storeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tas-runtime-e2e-'));
});

after(() => {
  fs.rmSync(storeDir, { recursive: true, force: true });
});

const startOnStore = (fileName) =>
  startServer({
    RATE_LIMIT_MAX: NO_RATE_LIMIT,
    TAS_RUNTIME_STATE_PATH: path.join(storeDir, fileName),
  });

test('a run survives its recording across a clean restart - as nothing running', async (t) => {
  const fileName = `${unique('clean-restart')}.json`;
  const first = await startOnStore(fileName);
  const name = unique('clean-run');
  try {
    const started = await request(first.baseUrl, 'POST', '/api/simulation/start', {
      body: { model: emptyModel(name), options: { dataStorage: storageConfig() } },
    });
    assert.equal(started.status, 200, `the run must start (${started.raw})`);

    // A graceful stop of the SERVER deliberately takes its runs down with it:
    // the registry drops them on the way out.
    await first.stop();

    const second = await startOnStore(fileName);
    try {
      const status = await request(second.baseUrl, 'GET', '/api/simulation/status');
      assert.equal(status.status, 200, `status must be served (${status.raw})`);
      const entries = Object.values(status.body.simulationStatus || {});
      assert.deepEqual(
        entries.filter((entry) => entry.model === name),
        [],
        `a clean restart must report no ghosts: ${status.raw}`
      );

      // Stopping still works after the restart: an id from before it is a
      // harmless no-op answered with the current status.
      const stopped = await request(
        second.baseUrl,
        'GET',
        `/api/simulation/stop/${encodeURIComponent(name)}.json`
      );
      assert.equal(stopped.status, 200, `stop must still answer after restart (${stopped.raw})`);
    } finally {
      await second.stop();
    }
  } finally {
    if (first.child.exitCode === null) await first.stop();
  }
});

test('work orphaned by an unclean shutdown is cleaned up by the next boot', async (t) => {
  const fileName = `${unique('unclean-restart')}.json`;
  const first = await startOnStore(fileName);
  const name = unique('orphaned-run');
  const started = await request(first.baseUrl, 'POST', '/api/simulation/start', {
    body: { model: emptyModel(name), options: { dataStorage: storageConfig() } },
  });
  assert.equal(started.status, 200, `the run must start (${started.raw})`);

  // Unclean death: no graceful shutdown runs, so the record stays behind.
  first.child.kill('SIGKILL');
  await new Promise((resolve) => {
    if (first.child.exitCode !== null) return resolve();
    first.child.once('exit', resolve);
  });

  const second = await startOnStore(fileName);
  try {
    const status = await request(second.baseUrl, 'GET', '/api/simulation/status');
    assert.equal(status.status, 200, `status must be served (${status.raw})`);
    const entries = Object.values(status.body.simulationStatus || {}).filter(
      (entry) => entry.model === name
    );
    assert.deepEqual(
      entries,
      [],
      `the orphaned run must not be reported as running: ${status.raw}`
    );
  } finally {
    await second.stop();
  }
});

test('two processes sharing a store observe one consistent view', async (t) => {
  const fileName = `${unique('shared-view')}.json`;
  const alpha = await startOnStore(fileName);
  const beta = await startOnStore(fileName);
  const name = unique('shared-run');
  try {
    const started = await request(alpha.baseUrl, 'POST', '/api/simulation/start', {
      body: { model: emptyModel(name), options: { dataStorage: storageConfig() } },
    });
    assert.equal(started.status, 200, `the run must start on the first process (${started.raw})`);

    // The second process SEES the first's run...
    const seenByBeta = await request(beta.baseUrl, 'GET', '/api/simulation/status');
    const entry = Object.values(seenByBeta.body.simulationStatus || {}).find(
      (candidate) => candidate.model === name
    );
    assert.ok(entry, `the other process must observe the run: ${seenByBeta.raw}`);
    assert.equal(entry.isRunning, true, 'observed as running');

    // ...and the same topology is refused there while the first process has it.
    const doubleStart = await request(beta.baseUrl, 'POST', '/api/simulation/start', {
      body: { model: emptyModel(name), options: { dataStorage: storageConfig() } },
    });
    assert.equal(
      doubleStart.status,
      409,
      `a topology in use is a conflict everywhere (${doubleStart.raw})`
    );

    // When the owning process stops the run, the observer stops seeing it.
    const stopped = await request(
      alpha.baseUrl,
      'GET',
      `/api/simulation/stop/${encodeURIComponent(name)}.json`
    );
    assert.equal(stopped.status, 200, `the owner must stop its run (${stopped.raw})`);

    const afterStop = await request(beta.baseUrl, 'GET', '/api/simulation/status');
    const ghosts = Object.values(afterStop.body.simulationStatus || {}).filter(
      (candidate) => candidate.model === name
    );
    assert.deepEqual(ghosts, [], `the stop must be visible to the other process: ${afterStop.raw}`);
  } finally {
    await alpha.stop();
    await beta.stop();
  }
});

test('repeated start-stop cycles leave the persisted registry empty', async (t) => {
  const fileName = `${unique('reaping')}.json`;
  const server = await startOnStore(fileName);
  const names = [];
  try {
    for (let cycle = 0; cycle < 3; cycle++) {
      const name = unique(`reap-cycle-${cycle}`);
      names.push(name);
      const started = await request(server.baseUrl, 'POST', '/api/simulation/start', {
        body: { model: emptyModel(name), options: { dataStorage: storageConfig() } },
      });
      assert.equal(started.status, 200, `cycle ${cycle} must start (${started.raw})`);
      const stopped = await request(
        server.baseUrl,
        'GET',
        `/api/simulation/stop/${encodeURIComponent(name)}.json`
      );
      assert.equal(stopped.status, 200, `cycle ${cycle} must stop (${stopped.raw})`);
    }

    const raw = JSON.parse(fs.readFileSync(path.join(storeDir, fileName), 'utf8'));
    const held = Object.keys(raw.simulations || {});
    assert.deepEqual(held, [], `stopped entries are reaped, none accumulate: ${raw.simulations}`);
  } finally {
    for (const name of names) {
      await request(server.baseUrl, 'GET', `/api/simulation/stop/${encodeURIComponent(name)}.json`);
    }
    await server.stop();
  }
});
