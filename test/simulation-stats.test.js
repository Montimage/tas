// Simulation statistics endpoint (issue #16).
//
// The route used to read a binding that was never assigned, so every call
// threw a ReferenceError; PR #61 rewrote it onto the router's own registry.
// What was still missing on master was strict mode - without it an
// undeclared assignment in this module silently becomes a global that
// persists across requests - and behavioural coverage of the running,
// stopped and isolated-states paths. No live MongoDB is needed: the default
// data-storage configuration is read from the committed file and no run
// here declares devices, so nothing ever connects.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const { request } = require('./_http');

const simulationRouter = require('../src/server/routes/simulation');
const { OFFLINE, SIMULATING } = require('../src/core/DeviceStatus');
const { getObjectId } = require('../src/core/utils');

const simulationLogsDir = path.resolve(__dirname, '../src/server/logs/simulations');

let server;

// Issue #29: run state persists in a JSON store that real servers share.
// This suite mounts the router in-process, so it pins its own empty store -
// otherwise records left by another suite's process (or an earlier run of
// this one) could bleed into what /status reports here.
const runtimeStorePath = path.join(__dirname, `.runtime-state-${process.pid}.json`);

before(() => {
  process.env.TAS_RUNTIME_STATE_PATH = runtimeStorePath;
  // Nothing under src/server/logs is tracked, so on a fresh checkout the
  // directory does not exist and a start would have nowhere to log.
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

/** Remove the run log a start leaves behind; nothing else ever does. */
const removeRunLogs = (name) => {
  let entries;
  try {
    entries = fs.readdirSync(simulationLogsDir);
  } catch (e) {
    return;
  }
  for (const entry of entries) {
    if (entry.startsWith(`${name}_`)) fs.unlinkSync(path.join(simulationLogsDir, entry));
  }
};

test('requesting statistics with no simulation running answers null stats, not an error', async () => {
  const res = await request(server, 'GET', '/api/simulation/stats');
  assert.equal(res.status, 200, `stats must be served (${res.raw})`);
  assert.equal(res.body.error, null, `a served call carries no error (${res.raw})`);
  assert.equal(res.body.stats, null, 'an empty registry has nothing to report');
});

test('a running simulation reports its statistics, and stops reporting once stopped', async () => {
  const name = unique('stats-topology');
  try {
    const started = await request(server, 'POST', '/api/simulation/start', {
      model: { name, devices: [] },
      options: {},
    });
    assert.equal(started.status, 200, `the run must start (${started.raw})`);

    const stats = await request(server, 'GET', '/api/simulation/stats');
    assert.equal(stats.status, 200, `stats must be served while running (${stats.raw})`);
    assert.equal(stats.body.error, null, `a served call carries no error (${stats.raw})`);
    assert.ok(
      Array.isArray(stats.body.stats),
      `a running simulation must report its statistics (${stats.raw})`
    );

    const stopped = await request(server, 'GET', `/api/simulation/stop/${name}.json`);
    assert.equal(stopped.status, 200, `the run must stop (${stopped.raw})`);

    const afterStop = await request(server, 'GET', '/api/simulation/stats');
    assert.equal(afterStop.status, 200, `stats must still be served (${afterStop.raw})`);
    assert.equal(
      afterStop.body.stats,
      null,
      `a stopped simulation must not report statistics (${afterStop.raw})`
    );
  } finally {
    await request(server, 'GET', `/api/simulation/stop/${name}.json`);
    removeRunLogs(name);
  }
});

test('concurrent runs of different topologies keep their state apart', async () => {
  // The bug class behind this issue was shared module-level state: two
  // handlers assigning undeclared names created globals one request could
  // read into another's. The registry keys each run by its topology id, so
  // two topologies started together are registered, reported and stopped
  // independently of each other.
  const first = unique('iv-stats-a');
  const second = unique('iv-stats-b');
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
      starts.map((start) => start.status),
      [200, 200],
      `both distinct topologies must be servable (${starts.map((start) => start.raw).join(' | ')})`
    );

    const status = await request(server, 'GET', '/api/simulation/status');
    assert.equal(status.status, 200, `status must be served (${status.raw})`);
    // The registry keys each run by the hashed topology id, not the name.
    const entries = status.body.simulationStatus || {};
    assert.equal(
      entries[getObjectId(second)].isRunning,
      true,
      'the second run must be its own entry'
    );
    assert.notEqual(
      getObjectId(first),
      getObjectId(second),
      'the two runs must not collapse onto one key'
    );

    await request(server, 'GET', `/api/simulation/stop/${first}.json`);
    const afterFirstStops = await request(server, 'GET', '/api/simulation/status');
    const entriesAfter = afterFirstStops.body.simulationStatus || {};
    // Issue #29: a stopped entry is REAPED rather than left as a placeholder,
    // so repeated runs cannot grow the tracking state - the first run is gone
    // from the status map entirely while the other run is untouched.
    assert.equal(
      entriesAfter[getObjectId(first)],
      undefined,
      'the stopped run is reaped, not kept as a placeholder'
    );
    assert.equal(entriesAfter[getObjectId(second)].isRunning, true, 'the other run is untouched');
  } finally {
    await request(server, 'GET', `/api/simulation/stop/${first}.json`);
    await request(server, 'GET', `/api/simulation/stop/${second}.json`);
    removeRunLogs(first);
    removeRunLogs(second);
  }
});

test('a run that finishes on its own is reaped, not reported as running forever', async () => {
  // Devices can complete without anyone calling /stop; the core then stops
  // the run itself (issue #16's status predicate). The registry must notice
  // on the next status poll and drop the record - and release the run's log
  // handle while it still knows where it is (#29 review fix).
  const name = unique('self-finish');
  const runtimeState = require('../src/server/runtime-state');
  const simId = getObjectId(name);
  try {
    const started = await request(server, 'POST', '/api/simulation/start', {
      model: { name, devices: [] },
      options: {},
    });
    assert.equal(started.status, 200, `the run must start (${started.raw})`);

    // The natural end: the core run stops itself exactly as it does when its
    // last device finishes.
    const handle = runtimeState.getHandle('simulations', simId);
    assert.ok(handle && handle.run, 'the running run has a handle');
    handle.run.stop();

    const res = await request(server, 'GET', '/api/simulation/status');
    const entries = res.body.simulationStatus || {};
    assert.equal(
      entries[simId],
      undefined,
      'the self-finished run must be reaped from the status map'
    );
    assert.equal(
      (await request(server, 'GET', '/api/simulation/stats')).body.stats,
      null,
      'and it no longer reports statistics'
    );
  } finally {
    await request(server, 'GET', `/api/simulation/stop/${name}.json`);
    removeRunLogs(name);
  }
});

test('the module runs in strict mode so an undeclared assignment fails loudly', () => {
  // Strict mode is what turns this issue's whole bug class - assigning to a
  // name that was never declared - from a silent cross-request global into
  // a ReferenceError at the moment of the mistake.
  const source = fs.readFileSync(
    path.resolve(__dirname, '../src/server/routes/simulation.js'),
    'utf8'
  );
  assert.match(
    source,
    /^['"]use strict['"];/,
    'simulation.js must open with a use strict directive'
  );

  // The predicate /status and /stats read is the class's own status field:
  // pinning it here keeps a future rename from silently deadening both.
  const Simulation = require('../src/core/simulation');
  const simulation = new Simulation({ name: unique('strict-probe'), devices: [] }, {});
  assert.equal(simulation.status, OFFLINE, 'a fresh run is offline');
  simulation.start();
  try {
    assert.equal(simulation.status, SIMULATING, 'start() marks the run running');
  } finally {
    simulation.stop();
  }
  assert.equal(simulation.status, OFFLINE, 'stop() marks the run offline');
});
