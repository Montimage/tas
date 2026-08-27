/**
 * End-to-end simulation lifecycle suite (issue #21) — the Phase 2 milestone
 * gate. It drives a complete simulation lifecycle against REAL, separately
 * spawned instances over HTTP and asserts the observability and error-reporting
 * behaviour this milestone repairs: concurrent per-run logging, statistics,
 * save failures and handle release. These are properties of a running system —
 * no amount of inspection proves them.
 *
 * Coverage matrix and what each test needs:
 *
 *   - Concurrent log isolation, statistics, unwritable-save, data-storage save
 *     refusal and handle stability need NOTHING but the application itself:
 *     they run everywhere.
 *   - A data-producing run and the error-detail-in-log assertions additionally
 *     need an MQTT broker (devices cannot initialise without one) and/or a
 *     reachable MongoDB. Each such test probes for its dependency at runtime
 *     and SKIPS with an explicit reason when it is absent, so the gate stays
 *     green on a bare checkout while proving everything wherever the services
 *     exist.
 *
 * Broker/database locations can be overridden for a particular run:
 *
 *   TAS_E2E_MQTT_HOST / TAS_E2E_MQTT_PORT   MQTT broker for device init
 *   TAS_E2E_MONGO_HOST / TAS_E2E_MONGO_PORT MongoDB for persistence assertions
 */
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const net = require('node:net');
const path = require('node:path');

const {
  startServer,
  request,
  unique,
  modelsDir,
  simulationsLogsDir,
  dataStoragePath,
} = require('./helpers');

/** A ceiling high enough that no test in this file trips the limiter. */
const NO_RATE_LIMIT = '100000';

const mongoHost = process.env.TAS_E2E_MONGO_HOST || '127.0.0.1';
const mongoPort = Number(process.env.TAS_E2E_MONGO_PORT || 27017);
const mqttHost = process.env.TAS_E2E_MQTT_HOST || '127.0.0.1';
const mqttPort = Number(process.env.TAS_E2E_MQTT_PORT || 1883);

/** Availability probed once, before any test runs; false means "skip politely". */
let mongoUp = false;
let mqttUp = false;

/**
 * A schema-valid data-storage configuration pointing somewhere specific. It is
 * only ever handed to a run whose topology declares NO devices, or used as an
 * explicit target, so nothing connects to it unless a test means it to.
 */
const storageConfig = (host, port, dbname) => ({
  protocol: 'MONGODB',
  connConfig: { host, port, username: null, password: null, dbname, options: null },
});

/** A topology with one generator sensor behind an MQTT test broker. */
const deviceModel = (name) => ({
  name,
  devices: [
    {
      id: 'device-01',
      name: 'Lifecycle Device',
      enable: true,
      scale: 1,
      behaviours: [],
      timeToFailed: 0,
      testBroker: {
        protocol: 'MQTT',
        connConfig: { host: mqttHost, port: mqttPort, options: null },
      },
      productionBroker: null,
      isReplayingStreams: false,
      sensors: [
        {
          id: 'lifecycle-sensor',
          objectId: null,
          name: 'Lifecycle Sensor',
          enable: true,
          topic: `sensors/${name}/data`,
          dataSource: 'DATA_SOURCE_GENERATOR',
          replayOptions: null,
          dataSpecs: {
            timePeriod: 1,
            sources: [{ type: 'DATA_SOURCE_INTEGER', key: 'value', initValue: 1 }],
          },
        },
      ],
      actuators: [],
      upStreams: [],
      downStreams: [],
    },
  ],
});

/** A topology with no devices at all: registers a run without touching any broker. */
const emptyModel = (name) => ({ name, devices: [] });

/**
 * Resolve a TCP endpoint quickly. A refused connection answers immediately;
 * the timeout exists so an silently-dropping firewall cannot park the suite.
 * @param {String} host Host to probe
 * @param {Number} port Port to probe
 * @returns {Promise<Boolean>} Whether something accepted the connection
 */
const probeTcp = (host, port) =>
  new Promise((resolve) => {
    const socket = net.connect({ host, port });
    const settle = (answer) => {
      socket.destroy();
      resolve(answer);
    };
    socket.setTimeout(1500);
    socket.once('connect', () => settle(true));
    socket.once('timeout', () => settle(false));
    socket.once('error', () => settle(false));
  });

/**
 * Poll an async predicate until it holds or the deadline passes, handing back
 * the truthy value that satisfied it (callers may need more than a boolean).
 * @param {Function} probe Async predicate, re-evaluated every pollMs
 * @param {Number} deadlineMs Total budget
 * @returns {Promise<*>} The first truthy probe result, or false
 */
const eventually = async (probe, deadlineMs) => {
  const deadline = Date.now() + deadlineMs;
  while (Date.now() < deadline) {
    const result = await probe();
    if (result) return result;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return (await probe()) || false;
};

/**
 * Assert a promise settles before the deadline — the concrete meaning of
 * "returns a prompt error rather than hanging the request". The timer is
 * disarmed the moment the work settles so it never holds the runner open.
 * @param {Promise} work The request under test
 * @param {Number} deadlineMs Budget within which a well-behaved handler answers
 * @param {String} context What was being waited for (failure message)
 */
const withinDeadline = (work, deadlineMs, context) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`${context} — still unanswered after ${deadlineMs}ms`)),
      deadlineMs
    );
    work.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });

/** Read a run's log back through the API, the way the dashboard does. */
const readSimulationLog = async (baseUrl, logFile) => {
  const res = await request(baseUrl, 'GET', `/api/logs/simulations/${encodeURIComponent(logFile)}`);
  assert.equal(res.status, 200, `the run log must be readable: ${res.raw}`);
  return res.body.content;
};

/** Delete every run log this suite created for a topology name. */
const removeRunLogs = (name) => {
  let entries = [];
  try {
    entries = fs.readdirSync(simulationsLogsDir);
  } catch (_) {
    return; // absent, which is the expected case on a fresh checkout
  }
  for (const entry of entries) {
    if (entry.startsWith(`${name}_`)) removeIfPresent(path.join(simulationsLogsDir, entry));
  }
};

const removeIfPresent = (filePath) => {
  try {
    fs.unlinkSync(filePath);
  } catch (_) {
    /* absent, which is the expected case */
  }
};

/** Stop a run through the API, tolerating an already-stopped registry. */
const stopRun = (baseUrl, name) =>
  request(baseUrl, 'GET', `/api/simulation/stop/${encodeURIComponent(name)}.json`);

// ---------------------------------------------------------------------------
// Shared bootstrapping
// ---------------------------------------------------------------------------

before(async () => {
  // Nothing under src/server/logs is created up front by the application, so
  // give the run loggers their directory before anything starts.
  fs.mkdirSync(simulationsLogsDir, { recursive: true });
  [mongoUp, mqttUp] = await Promise.all([
    probeTcp(mongoHost, mongoPort),
    probeTcp(mqttHost, mqttPort),
  ]);
});

after(() => {
  // The tracked data-storage configuration must leave this suite exactly as it
  // entered it: section 5 legitimately persists a configuration through the
  // API, and the bytes below restore whatever the checkout carried before.
  try {
    if (dataStorageBaseline && fs.readFileSync(dataStoragePath, 'utf8') !== dataStorageBaseline) {
      fs.writeFileSync(dataStoragePath, dataStorageBaseline);
    }
  } catch (_) {
    /* the file may never have existed; nothing this suite wrote survives that case */
  }
});

// ---------------------------------------------------------------------------
// 1. AC — two concurrent simulations write only their own lines to their own
//    log files
// ---------------------------------------------------------------------------

let concurrent;

before(async () => {
  concurrent = await startServer({ RATE_LIMIT_MAX: NO_RATE_LIMIT });
});

after(async () => {
  if (concurrent) await concurrent.stop();
});

test('two simulations started concurrently keep their log files apart', async () => {
  const first = unique('concurrent-a');
  const second = unique('concurrent-b');
  try {
    // Both starts go out together and take the synchronous registration path
    // (an explicit data storage), so each run creates its own logger inside
    // its own request handler.
    const starts = await Promise.all([
      request(concurrent.baseUrl, 'POST', '/api/simulation/start', {
        body: {
          model: emptyModel(first),
          options: { dataStorage: storageConfig('127.0.0.1', mongoPort, null) },
        },
      }),
      request(concurrent.baseUrl, 'POST', '/api/simulation/start', {
        body: {
          model: emptyModel(second),
          options: { dataStorage: storageConfig('127.0.0.1', mongoPort, null) },
        },
      }),
    ]);
    assert.deepEqual(
      starts.map((start) => start.status),
      [200, 200],
      `both concurrent starts must succeed (${starts.map((start) => start.raw).join(' | ')})`
    );

    const status = await request(concurrent.baseUrl, 'GET', '/api/simulation/status');
    const entries = Object.values(status.body.simulationStatus || {});
    const firstEntry = entries.find((entry) => entry.model === first);
    const secondEntry = entries.find((entry) => entry.model === second);
    assert.ok(firstEntry && secondEntry, `both runs must be registered: ${status.raw}`);
    assert.notEqual(
      firstEntry.logFile,
      secondEntry.logFile,
      'each run must have been given its own log file'
    );

    // Wait until each file carries its own startup line, then prove neither
    // file knows anything about the other run.
    const firstOwn = await eventually(
      async () => (await readSimulationLog(concurrent.baseUrl, firstEntry.logFile)).includes(first),
      10000
    );
    const secondOwn = await eventually(
      async () =>
        (await readSimulationLog(concurrent.baseUrl, secondEntry.logFile)).includes(second),
      10000
    );
    assert.ok(firstOwn, `the first run's log must contain its own lines`);
    assert.ok(secondOwn, `the second run's log must contain its own lines`);

    const firstContent = await readSimulationLog(concurrent.baseUrl, firstEntry.logFile);
    const secondContent = await readSimulationLog(concurrent.baseUrl, secondEntry.logFile);
    assert.ok(
      !firstContent.includes(second),
      `a run's log file must not contain the concurrent run's lines:\n${firstContent}`
    );
    assert.ok(
      !secondContent.includes(first),
      `a run's log file must not contain the concurrent run's lines:\n${secondContent}`
    );
  } finally {
    await stopRun(concurrent.baseUrl, first);
    await stopRun(concurrent.baseUrl, second);
    removeRunLogs(first);
    removeRunLogs(second);
  }
});

// ---------------------------------------------------------------------------
// 2. AC — statistics are retrievable for a running simulation and respond
//    correctly when none is known
// ---------------------------------------------------------------------------

let statsServer;

before(async () => {
  statsServer = await startServer({ RATE_LIMIT_MAX: NO_RATE_LIMIT });
});

after(async () => {
  if (statsServer) await statsServer.stop();
});

test('statistics answer null for an instance where nothing ever ran', async () => {
  const res = await request(statsServer.baseUrl, 'GET', '/api/simulation/stats');
  assert.equal(res.status, 200, `stats must be served: ${res.raw}`);
  assert.equal(res.body.error, null, `a served call carries no error: ${res.raw}`);
  assert.equal(res.body.stats, null, `nothing running must report null stats: ${res.raw}`);
});

test('statistics are retrievable while a simulation is running', async () => {
  const name = unique('stats-lifecycle');
  try {
    const started = await request(statsServer.baseUrl, 'POST', '/api/simulation/start', {
      body: {
        model: emptyModel(name),
        options: { dataStorage: storageConfig('127.0.0.1', mongoPort, null) },
      },
    });
    assert.equal(started.status, 200, `the run must start: ${started.raw}`);

    const res = await request(statsServer.baseUrl, 'GET', '/api/simulation/stats');
    assert.equal(res.status, 200, `stats must be served while running: ${res.raw}`);
    assert.equal(res.body.error, null, `a served call carries no error: ${res.raw}`);
    assert.ok(Array.isArray(res.body.stats), `a running simulation reports its stats: ${res.raw}`);
  } finally {
    await stopRun(statsServer.baseUrl, name);
    removeRunLogs(name);
  }
});

test('statistics fall back to null again once the run is stopped', async () => {
  const name = unique('stats-stopped');
  try {
    const started = await request(statsServer.baseUrl, 'POST', '/api/simulation/start', {
      body: {
        model: emptyModel(name),
        options: { dataStorage: storageConfig('127.0.0.1', mongoPort, null) },
      },
    });
    assert.equal(started.status, 200, `the run must start: ${started.raw}`);
  } finally {
    const stopped = await stopRun(statsServer.baseUrl, name);
    assert.equal(stopped.status, 200, `the run must stop: ${stopped.raw}`);
    removeRunLogs(name);
  }

  const res = await request(statsServer.baseUrl, 'GET', '/api/simulation/stats');
  assert.equal(res.status, 200, `stats must still be served: ${res.raw}`);
  assert.equal(
    res.body.stats,
    null,
    `with no known running simulation, stats must be null: ${res.raw}`
  );
});

// ---------------------------------------------------------------------------
// 3. AC — a save against an unwritable location returns a prompt error rather
//    than hanging the request
// ---------------------------------------------------------------------------

test('saving a topology into an unwritable models directory fails promptly', async (t) => {
  const originalMode = fs.statSync(modelsDir).mode & 0o777;
  let unwritable = false;
  try {
    fs.chmodSync(modelsDir, 0o555);
    // Root ignores directory write bits, so on a root-run instance the premise
    // of this test cannot be staged; say so instead of asserting nonsense.
    try {
      fs.accessSync(modelsDir, fs.constants.W_OK);
    } catch (_) {
      unwritable = true;
    }
  } catch (chmodErr) {
    fs.chmodSync(modelsDir, originalMode);
    throw chmodErr;
  }
  if (!unwritable) {
    fs.chmodSync(modelsDir, originalMode);
    return t.skip('models directory permissions are not enforceable for this user (root?)');
  }

  const server = await startServer({ RATE_LIMIT_MAX: NO_RATE_LIMIT });
  try {
    const name = unique('unwritable');
    const started = Date.now();
    const res = await withinDeadline(
      request(server.baseUrl, 'POST', '/api/models', {
        body: { model: emptyModel(name) },
      }),
      15000,
      'the save against the unwritable location'
    );
    assert.equal(
      res.status,
      500,
      `an unwritable location is a server fault answered with 500: ${res.raw}`
    );
    assert.equal(
      res.body.error,
      'Cannot save the new configuration',
      `the failure must be reported, not swallowed: ${res.raw}`
    );
    assert.ok(
      !fs.existsSync(path.join(modelsDir, `${name}.json`)),
      'nothing may be written where writing fails'
    );
    const elapsed = Date.now() - started;
    assert.ok(elapsed < 15000, `the error must arrive promptly (took ${elapsed}ms)`);
  } finally {
    await server.stop();
    fs.chmodSync(modelsDir, originalMode);
  }
  assert.doesNotThrow(
    () => fs.accessSync(modelsDir, fs.constants.W_OK),
    'the mode must be restored'
  );
});

// ---------------------------------------------------------------------------
// 4. AC — saving an unreachable data-storage configuration returns an error
//    and the working configuration survives
// ---------------------------------------------------------------------------

/**
 * The exact bytes of the tracked data-storage configuration as found. Section
 * 4's successful save genuinely persists through the API (that is the point),
 * so the file is restored byte-for-byte afterwards.
 */
const dataStorageBaseline = fs.existsSync(dataStoragePath)
  ? fs.readFileSync(dataStoragePath, 'utf8')
  : null;

let storageServer;

before(async () => {
  storageServer = await startServer({ RATE_LIMIT_MAX: NO_RATE_LIMIT });
});

after(async () => {
  if (storageServer) await storageServer.stop();
  if (dataStorageBaseline !== null && fs.existsSync(dataStoragePath)) {
    if (fs.readFileSync(dataStoragePath, 'utf8') !== dataStorageBaseline) {
      fs.writeFileSync(dataStoragePath, dataStorageBaseline);
    }
  }
});

const UNREACHABLE = () => storageConfig('127.0.0.1', 1, 'tas-e2e-unreachable');

test('a save whose proposed database cannot be reached is refused, leaving the previous configuration intact', async () => {
  const before_ = await request(storageServer.baseUrl, 'GET', '/api/data-storage');
  assert.equal(before_.status, 200, `the current configuration must be readable: ${before_.raw}`);

  const res = await withinDeadline(
    request(storageServer.baseUrl, 'POST', '/api/data-storage', {
      body: { dataStorage: UNREACHABLE() },
    }),
    60000,
    'the refusal of the unreachable configuration'
  );
  assert.equal(res.status, 503, `an unreachable proposal is a dependency failure: ${res.raw}`);
  assert.equal(
    res.body.error,
    'Data storage not updated: cannot connect to the proposed database',
    `the refusal must say why: ${res.raw}`
  );

  const after_ = await request(storageServer.baseUrl, 'GET', '/api/data-storage');
  assert.equal(after_.status, 200, `the configuration must still be readable: ${after_.raw}`);
  assert.deepEqual(
    after_.body.dataStorage,
    before_.body.dataStorage,
    'the working configuration must survive a refused save unchanged'
  );
});

test('a verified working configuration survives a later refused save too', async (t) => {
  if (!mongoUp) return t.skip('no reachable MongoDB to verify a working configuration against');
  const working = storageConfig(mongoHost, mongoPort, 'tas_e2e_storage');

  const saved = await withinDeadline(
    request(storageServer.baseUrl, 'POST', '/api/data-storage', { body: { dataStorage: working } }),
    30000,
    'the save of the reachable configuration'
  );
  assert.equal(saved.status, 200, `a reachable configuration must be accepted: ${saved.raw}`);

  const tested = await request(storageServer.baseUrl, 'GET', '/api/data-storage/test');
  assert.equal(tested.status, 200, `the saved configuration must connect: ${tested.raw}`);
  assert.equal(tested.body.connectionStatus, true, `the connection test must pass: ${tested.raw}`);

  const refused = await withinDeadline(
    request(storageServer.baseUrl, 'POST', '/api/data-storage', {
      body: { dataStorage: UNREACHABLE() },
    }),
    60000,
    'the second refusal'
  );
  assert.equal(
    refused.status,
    503,
    `the unreachable proposal must still be refused: ${refused.raw}`
  );

  const survived = await request(storageServer.baseUrl, 'GET', '/api/data-storage');
  assert.deepEqual(survived.body.dataStorage, working, 'the working configuration must survive');

  // The successful save genuinely persisted through the API — that is the
  // point. Restore the tracked file here already, rather than only in the
  // file-level backstop, so the sections that follow this one can never
  // inherit a mutated configuration and a hard crash cannot leave the
  // checkout dirty.
  if (
    dataStorageBaseline !== null &&
    fs.readFileSync(dataStoragePath, 'utf8') !== dataStorageBaseline
  ) {
    fs.writeFileSync(dataStoragePath, dataStorageBaseline);
  }
});

// ---------------------------------------------------------------------------
// 5. AC — a simulation is started, produces data, and is stopped, all through
//    the API
// ---------------------------------------------------------------------------

test('a started simulation produces data and stops through the API', async (t) => {
  if (!mqttUp || !mongoUp) {
    return t.skip('needs a reachable MQTT broker and MongoDB');
  }
  const server = await startServer({
    RATE_LIMIT_MAX: NO_RATE_LIMIT,
    TAS_MQTT_HOST: mqttHost,
    TAS_MQTT_PORT: String(mqttPort),
  });
  const mongoose = require('mongoose');
  const name = unique('lifecycle');
  try {
    const started = await request(server.baseUrl, 'POST', '/api/simulation/start', {
      body: {
        model: deviceModel(name),
        options: { dataStorage: storageConfig(mongoHost, mongoPort, 'tas_e2e_lifecycle') },
      },
    });
    assert.equal(started.status, 200, `the run must start: ${started.raw}`);

    const status = await request(server.baseUrl, 'GET', '/api/simulation/status');
    const entry = Object.values(status.body.simulationStatus || {}).find((e) => e.model === name);
    assert.ok(entry, `the run must be registered: ${status.raw}`);
    assert.equal(entry.isRunning, true, `the run must be running: ${status.raw}`);

    // Produced data, part 1: the device publishes generated readings, and the
    // per-device counters surface them through the statistics endpoint.
    const sent = await eventually(async () => {
      const res = await request(server.baseUrl, 'GET', '/api/simulation/stats');
      const rows = Array.isArray(res.body && res.body.stats) ? res.body.stats : [];
      return rows.reduce((total, row) => total + (row.numberOfSentData || 0), 0) > 0;
    }, 30000);
    assert.ok(sent, 'the running simulation must send generated data');

    // Produced data, part 2: those readings land in the declared dataset in
    // the configured MongoDB, and the run registers its report there.
    const datasetId = entry.newDataset && entry.newDataset.id;
    assert.ok(datasetId, `the run must own a dataset: ${status.raw}`);
    await mongoose.connect(`mongodb://${mongoHost}:${mongoPort}`, { dbName: 'tas_e2e_lifecycle' });
    const { EventSchema, ReportSchema } = require('../../src/core/enact-mongoose');
    const eventsStored = await eventually(async () => {
      // A transient read failure is retried on the next poll, not surfaced
      // as an unrelated rejection.
      const count = await EventSchema.countDocuments({ datasetId }).catch(() => 0);
      return count > 0;
    }, 20000);
    assert.ok(eventsStored, 'generated readings must be persisted into the dataset');
    const reports = await ReportSchema.countDocuments({ newDatasetId: datasetId });
    assert.ok(reports > 0, 'the run must have registered its report');

    const stopped = await stopRun(server.baseUrl, name);
    assert.equal(stopped.status, 200, `stopping the run must succeed: ${stopped.raw}`);
    const stoppedEntry = Object.values(stopped.body.simulationStatus || {}).find(
      (e) => e.model === name
    );
    assert.ok(stoppedEntry, `the stopped run must still be reported: ${stopped.raw}`);
    assert.equal(stoppedEntry.isRunning, false, `the run must be marked stopped: ${stopped.raw}`);
    assert.equal(
      typeof stoppedEntry.endTime,
      'number',
      `a stopped run carries the time it stopped: ${stopped.raw}`
    );
  } finally {
    await server.stop();
    await mongoose.disconnect().catch(() => {});
    removeRunLogs(name);
  }
});

// ---------------------------------------------------------------------------
// 6. AC — log output carries the accompanying error detail, not just the
//    message
// ---------------------------------------------------------------------------

test('a run whose data storage fails logs the message together with the underlying error detail', async (t) => {
  if (!mqttUp) {
    return t.skip(
      'needs a reachable MQTT broker so the device initialises far enough to reach its data storage'
    );
  }
  const server = await startServer({
    RATE_LIMIT_MAX: NO_RATE_LIMIT,
    TAS_MQTT_HOST: mqttHost,
    TAS_MQTT_PORT: String(mqttPort),
  });
  const name = unique('log-detail');
  try {
    // The broker is reachable so the device initialises; the run's OWN data
    // storage points at a dead port, which is the failure whose reporting is
    // under test. The connector gives up after its server-selection window,
    // hence the generous deadline below.
    const started = await request(server.baseUrl, 'POST', '/api/simulation/start', {
      body: { model: deviceModel(name), options: { dataStorage: UNREACHABLE() } },
    });
    assert.equal(started.status, 200, `the run must start: ${started.raw}`);

    const status = await request(server.baseUrl, 'GET', '/api/simulation/status');
    const entry = Object.values(status.body.simulationStatus || {}).find((e) => e.model === name);
    assert.ok(entry && entry.logFile, `the run must be registered with a log file: ${status.raw}`);

    const content = await eventually(async () => {
      const text = await readSimulationLog(server.baseUrl, entry.logFile).catch(() => '');
      return text.includes('[DataStorage] ERROR: Failed to connect to database') ? text : '';
    }, 75000);
    assert.ok(content, 'the failure must reach the run log');

    // The message alone is not enough: the same output must carry the
    // underlying error and the connection parameters the logger was handed,
    // exactly the detail a single-argument console replacement drops. Records
    // are structured now (issue #47): the connection parameters arrive as
    // top-level JSON fields rather than inspected into the message text.
    assert.match(
      content,
      /ECONNREFUSED/,
      `the error detail must accompany the message:\n${content}`
    );
    assert.match(
      content,
      /"dbname"\s*:\s*"tas-e2e-unreachable"/,
      `the logged context must name the failed connection:\n${content}`
    );
  } finally {
    await stopRun(server.baseUrl, name);
    removeRunLogs(name);
    await server.stop();
  }
});

// ---------------------------------------------------------------------------
// 7. AC — repeated start-stop cycles do not grow the number of open file
//    handles
// ---------------------------------------------------------------------------

test('repeated start-stop cycles do not grow the number of open file handles', async (t) => {
  if (process.platform !== 'linux') {
    return t.skip('open-handle counting reads /proc');
  }
  const server = await startServer({ RATE_LIMIT_MAX: NO_RATE_LIMIT });
  const countFds = () => fs.readdirSync(`/proc/${server.child.pid}/fd`).length;
  const names = [];
  const startAndStop = async (name) => {
    names.push(name);
    const started = await request(server.baseUrl, 'POST', '/api/simulation/start', {
      body: {
        model: emptyModel(name),
        options: { dataStorage: storageConfig('127.0.0.1', mongoPort, null) },
      },
    });
    assert.equal(started.status, 200, `cycle for ${name} must start: ${started.raw}`);
    const stopped = await stopRun(server.baseUrl, name);
    assert.equal(stopped.status, 200, `cycle for ${name} must stop: ${stopped.raw}`);
  };

  try {
    // One warm-up cycle so one-time costs (transports created at boot, lazy
    // module loads triggered by the first request) cannot mask the leak the
    // assertion hunts: a run logger whose file handle is never released.
    await startAndStop(unique('fd-warmup'));
    await new Promise((resolve) => setTimeout(resolve, 500));

    const baseline = countFds();
    for (let cycle = 0; cycle < 10; cycle++) {
      await startAndStop(unique('fd-cycle'));
    }
    await new Promise((resolve) => setTimeout(resolve, 500));

    const grown = countFds() - baseline;
    assert.ok(
      grown <= 2,
      `ten start-stop cycles left ${grown} new open file handles behind — a run logger is leaking`
    );
  } finally {
    for (const name of names) {
      removeRunLogs(name);
    }
    await server.stop();
  }
});
