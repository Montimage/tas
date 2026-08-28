// Simulation lifecycle integration tests — start, stop, restart, and concurrent
// runs (issue #92).
//
// Drives a real Express app mounting the simulation router and asserts the
// full lifecycle: start → status → stats → stop → restart. No live MongoDB
// is needed: the default data-storage configuration is read from the
// committed file and no run here declares devices, so nothing ever connects.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const { request } = require('./_http');

const simulationRouter = require('../src/server/routes/simulation');
const { getObjectId } = require('../src/core/utils');

const simulationLogsDir = path.resolve(__dirname, '../src/server/logs/simulations');

/** A scratch runtime state so this suite doesn't collide with others. */
const runtimeStorePath = path.join(__dirname, `.runtime-state-sim-lifecycle-${process.pid}.json`);

let server;

before(() => {
  process.env.TAS_RUNTIME_STATE_PATH = runtimeStorePath;
  fs.mkdirSync(simulationLogsDir, { recursive: true });
  const app = express();
  app.use(express.json());
  app.use('/api/simulation', simulationRouter);
  server = app.listen(0);
});

after(() => {
  delete process.env.TAS_RUNTIME_STATE_PATH;
  fs.rmSync(runtimeStorePath, { force: true });
  fs.rmSync(`${runtimeStorePath}.lock`, { force: true });
  server.close();
});

const unique = (prefix) => `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

/** Remove the run log a start leaves behind. */
const removeRunLogs = (name) => {
  let entries;
  try {
    entries = fs.readdirSync(simulationLogsDir);
  } catch (_) {
    return;
  }
  for (const entry of entries) {
    if (entry.startsWith(`${name}_`)) fs.unlinkSync(path.join(simulationLogsDir, entry));
  }
};

// ---------------------------------------------------------------------------
// 1. Start → status → stop lifecycle
// ---------------------------------------------------------------------------

test('a simulation starts, appears in status, and stops cleanly', async () => {
  const name = unique('lifecycle-start-stop');
  try {
    const started = await request(server, 'POST', '/api/simulation/start', {
      model: { name, devices: [] },
      options: {},
    });
    assert.equal(started.status, 200, `start must succeed (${started.raw})`);
    assert.ok(started.body.simulationStatus, `start must return simulationStatus (${started.raw})`);

    const status = await request(server, 'GET', '/api/simulation/status');
    assert.equal(status.status, 200, `status must be served (${status.raw})`);
    const entries = status.body.simulationStatus || {};
    const entry = entries[getObjectId(name)];
    assert.ok(entry, `the run must be in the status map (${status.raw})`);
    assert.equal(entry.isRunning, true, `the run must be marked running (${status.raw})`);
    assert.equal(entry.model, name, `the run must report its model name (${status.raw})`);
    assert.equal(
      typeof entry.startedTime,
      'number',
      `startedTime must be a number (${status.raw})`
    );
    assert.equal(typeof entry.logFile, 'string', `logFile must be a string (${status.raw})`);
    assert.ok(entry.logFile.includes(name), `logFile must contain the model name (${status.raw})`);

    const stopped = await request(server, 'GET', `/api/simulation/stop/${name}.json`);
    assert.equal(stopped.status, 200, `stop must succeed (${stopped.raw})`);
    assert.ok(stopped.body.simulationStatus, `stop returns simulationStatus (${stopped.raw})`);

    const finalStatus = await request(server, 'GET', '/api/simulation/status');
    assert.equal(finalStatus.status, 200, `status must still be served (${finalStatus.raw})`);
    // The run is reaped: it no longer appears in the status map at all.
    assert.equal(
      finalStatus.body.simulationStatus && finalStatus.body.simulationStatus[getObjectId(name)],
      undefined,
      'the stopped run is reaped from the status map'
    );
  } finally {
    await request(server, 'GET', `/api/simulation/stop/${name}.json`);
    removeRunLogs(name);
  }
});

// ---------------------------------------------------------------------------
// 2. Restart — start the same topology twice
// ---------------------------------------------------------------------------

test('a stopped simulation can be restarted', async () => {
  const name = unique('restart');
  try {
    // First run
    const firstStart = await request(server, 'POST', '/api/simulation/start', {
      model: { name, devices: [] },
      options: {},
    });
    assert.equal(firstStart.status, 200, `first start must succeed (${firstStart.raw})`);

    const firstStatus = await request(server, 'GET', '/api/simulation/status');
    assert.equal(
      firstStatus.body.simulationStatus[getObjectId(name)].isRunning,
      true,
      'first run must be running'
    );

    await request(server, 'GET', `/api/simulation/stop/${name}.json`);

    // Second run
    const secondStart = await request(server, 'POST', '/api/simulation/start', {
      model: { name, devices: [] },
      options: {},
    });
    assert.equal(secondStart.status, 200, `re-start must succeed (${secondStart.raw})`);

    const secondStatus = await request(server, 'GET', '/api/simulation/status');
    const entry =
      secondStatus.body.simulationStatus && secondStatus.body.simulationStatus[getObjectId(name)];
    assert.ok(entry, 'the restarted run must be in the status map');
    assert.equal(entry.isRunning, true, 'the restarted run must be running');

    // The startedTime must be different from the first run.
    assert.notEqual(
      entry.startedTime,
      firstStart.body.simulationStatus[getObjectId(name)].startedTime,
      'the restart must have a new startedTime'
    );
  } finally {
    await request(server, 'GET', `/api/simulation/stop/${name}.json`);
    removeRunLogs(name);
  }
});

// ---------------------------------------------------------------------------
// 3. Concurrent runs of different topologies
// ---------------------------------------------------------------------------

test('two different topologies can run concurrently', async () => {
  const first = unique('concurrent-a');
  const second = unique('concurrent-b');
  try {
    const starts = await Promise.all([
      request(server, 'POST', '/api/simulation/start', {
        model: { name: first, devices: [] },
        options: {},
      }),
      request(server, 'POST', '/api/simulation/start', {
        model: { name: second, devices: [] },
        options: {},
      }),
    ]);
    assert.deepEqual(
      starts.map((s) => s.status),
      [200, 200],
      'both starts must succeed'
    );

    const status = await request(server, 'GET', '/api/simulation/status');
    const entries = status.body.simulationStatus || {};
    assert.ok(entries[getObjectId(first)], 'first topology must be registered');
    assert.ok(entries[getObjectId(second)], 'second topology must be registered');
    assert.equal(entries[getObjectId(first)].isRunning, true, 'first must be running');
    assert.equal(entries[getObjectId(second)].isRunning, true, 'second must be running');

    // Both must have separate log files.
    assert.notEqual(
      entries[getObjectId(first)].logFile,
      entries[getObjectId(second)].logFile,
      'each run must have its own log file'
    );
  } finally {
    await request(server, 'GET', `/api/simulation/stop/${first}.json`);
    await request(server, 'GET', `/api/simulation/stop/${second}.json`);
    removeRunLogs(first);
    removeRunLogs(second);
  }
});

// ---------------------------------------------------------------------------
// 4. Concurrent start of the same topology is rejected
// ---------------------------------------------------------------------------

test('starting the same topology twice concurrently returns conflict', async () => {
  const name = unique('double-start');
  try {
    const [first, second] = await Promise.all([
      request(server, 'POST', '/api/simulation/start', {
        model: { name, devices: [] },
        options: {},
      }),
      request(server, 'POST', '/api/simulation/start', {
        model: { name, devices: [] },
        options: {},
      }),
    ]);

    const won = first.status === 200 ? first : second;
    const lost = first.status === 200 ? second : first;

    assert.equal(won.status, 200, 'exactly one start must succeed');
    assert.equal(lost.status, 409, 'the duplicate start must be rejected with 409');
    assert.ok(lost.body && lost.body.error, 'the conflict must carry an error message');
  } finally {
    await request(server, 'GET', `/api/simulation/stop/${name}.json`);
    removeRunLogs(name);
  }
});

// ---------------------------------------------------------------------------
// 5. Status endpoint returns empty map when nothing is running
// ---------------------------------------------------------------------------

test('status returns an empty map when no simulations are running', async () => {
  const res = await request(server, 'GET', '/api/simulation/status');
  assert.equal(res.status, 200, `status must be served (${res.raw})`);
  assert.ok(res.body.simulationStatus, 'simulationStatus must be present');
  assert.deepEqual(
    res.body.simulationStatus,
    {},
    'the status map must be empty when nothing is running'
  );
});

// ---------------------------------------------------------------------------
// 6. Stats endpoint returns null when nothing is running
// ---------------------------------------------------------------------------

test('stats returns null when no simulation is running', async () => {
  const res = await request(server, 'GET', '/api/simulation/stats');
  assert.equal(res.status, 200, `stats must be served (${res.raw})`);
  assert.equal(res.body.error, null, 'no error when nothing is running');
  assert.equal(res.body.stats, null, 'stats must be null when nothing is running');
});

// ---------------------------------------------------------------------------
// 7. Stop of an unknown simulation returns the current status (no error)
// ---------------------------------------------------------------------------

test('stopping an unknown simulation returns current status without error', async () => {
  const name = unique('unknown-stop');
  const res = await request(server, 'GET', `/api/simulation/stop/${name}.json`);
  assert.equal(res.status, 200, `stop of unknown must return 200 (${res.raw})`);
  assert.equal(res.body.error, null, 'no error field for unknown stop');
  // The unknown id must not appear in the status map.
  const entries = res.body.simulationStatus || {};
  assert.equal(
    entries[getObjectId(name)],
    undefined,
    'an unknown id must not appear in the status map'
  );
});

// ---------------------------------------------------------------------------
// 8. Model name validation: invalid names are rejected
// ---------------------------------------------------------------------------

test('a model with an invalid name is rejected at start', async () => {
  const name = 'invalid name with spaces!';
  const res = await request(server, 'POST', '/api/simulation/start', {
    model: { name, devices: [] },
    options: {},
  });
  assert.equal(res.status, 400, `invalid name must be rejected (${res.raw})`);
  assert.ok(res.body && res.body.error, 'the rejection must carry an error');
});

// ---------------------------------------------------------------------------
// 9. Start without a model is rejected
// ---------------------------------------------------------------------------

test('starting without a model body is rejected', async () => {
  const res = await request(server, 'POST', '/api/simulation/start', {});
  assert.equal(res.status, 400, `missing model must be rejected (${res.raw})`);
});

// ---------------------------------------------------------------------------
// 10. Start with a model missing devices is rejected
// ---------------------------------------------------------------------------

test('starting with a model missing devices is rejected', async () => {
  const name = unique('no-devices');
  const res = await request(server, 'POST', '/api/simulation/start', {
    model: { name },
    options: {},
  });
  assert.equal(res.status, 400, `model without devices must be rejected (${res.raw})`);
});

// ---------------------------------------------------------------------------
// 11. A simulation with explicit dataStorage still starts
// ---------------------------------------------------------------------------

test('a simulation with explicit dataStorage starts without connecting', async () => {
  const name = unique('explicit-storage');
  try {
    const started = await request(server, 'POST', '/api/simulation/start', {
      model: { name, devices: [] },
      options: {
        dataStorage: {
          protocol: 'MONGODB',
          connConfig: {
            host: '127.0.0.1',
            port: 1,
            dbname: 'test',
            username: null,
            password: null,
          },
        },
      },
    });
    // The start succeeds because the model has no devices that need to
    // connect to the data storage. The simulation itself is created and
    // registered.
    assert.equal(started.status, 200, `start with explicit storage must succeed (${started.raw})`);
  } finally {
    await request(server, 'GET', `/api/simulation/stop/${name}.json`);
    removeRunLogs(name);
  }
});

// ---------------------------------------------------------------------------
// 12. Multiple start-stop cycles do not leak state
// ---------------------------------------------------------------------------

test('ten start-stop cycles leave the status map clean', async () => {
  const names = [];
  try {
    for (let i = 0; i < 10; i++) {
      const name = unique(`cycle-${i}`);
      names.push(name);
      const started = await request(server, 'POST', '/api/simulation/start', {
        model: { name, devices: [] },
        options: {},
      });
      assert.equal(started.status, 200, `cycle ${i} start must succeed`);
      await request(server, 'GET', `/api/simulation/stop/${name}.json`);
    }

    const status = await request(server, 'GET', '/api/simulation/status');
    assert.equal(status.status, 200, `status must be served after cycles (${status.raw})`);
    const entries = status.body.simulationStatus || {};
    assert.deepEqual(entries, {}, 'all cycles must be reaped; the status map must be empty');
  } finally {
    for (const name of names) {
      await request(server, 'GET', `/api/simulation/stop/${name}.json`);
      removeRunLogs(name);
    }
  }
});

// ---------------------------------------------------------------------------
// 13. The simulationStatus map includes all expected fields
// ---------------------------------------------------------------------------

test('a started simulation reports all expected fields in status', async () => {
  const name = unique('fields');
  try {
    const started = await request(server, 'POST', '/api/simulation/start', {
      model: { name, devices: [] },
      options: {},
    });
    assert.equal(started.status, 200);
    const entries = started.body.simulationStatus || {};
    const entry = entries[getObjectId(name)];
    assert.ok(entry, 'the entry must exist');

    // Assert the presence and types of all expected fields.
    assert.equal(typeof entry.id, 'string', 'id must be a string');
    assert.equal(entry.model, name, 'model must be the name');
    assert.equal(typeof entry.startedTime, 'number', 'startedTime must be a number');
    assert.equal(typeof entry.logFile, 'string', 'logFile must be a string');
    assert.equal(typeof entry.isRunning, 'boolean', 'isRunning must be a boolean');
    assert.equal(entry.isRunning, true, 'isRunning must be true');
    assert.equal(entry.stoppedTime, undefined, 'stoppedTime must be undefined while running');
  } finally {
    await request(server, 'GET', `/api/simulation/stop/${name}.json`);
    removeRunLogs(name);
  }
});
