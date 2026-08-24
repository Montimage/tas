/**
 * End-to-end modernised-stack suite (issue #33) — the Phase 4 milestone gate.
 *
 * The Phase 4 migration rewrote the database layer (Mongoose driver, #27),
 * replaced the simulation state model (persistent runtime registry, #29) and
 * moved user artefacts into the durable artifact store (#30). This gate
 * exercises a REAL, separately spawned instance of the migrated stack over
 * HTTP against the complete product workflow, asserting what inspection
 * cannot: recorded data still replays, scores still come out, old data is
 * still readable, restarts report the truth, and concurrent edits survive.
 *
 * Coverage matrix and what each test needs:
 *
 *   - Concurrent edits of one topology need NOTHING but the application:
 *     they run everywhere.
 *   - Reading data written by the pre-migration version needs a reachable
 *     MongoDB.
 *   - Restarting mid-simulation needs an MQTT broker (a producing device
 *     cannot initialise without one).
 *   - The complete workflow — define a topology, record data through the
 *     recorder, replay it in a simulation, generate the report and read its
 *     score — needs both services.
 *
 * Every service-dependent test probes for its dependency at runtime and SKIPS
 * with an explicit reason when absent, so the gate stays green on a bare
 * checkout while proving everything wherever the services exist.
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
const os = require('node:os');
const path = require('node:path');

const mqtt = require('mqtt');

const { startServer, request, unique, repoRoot } = require('./helpers');

/** A ceiling high enough that no test in this file trips the limiter. */
const NO_RATE_LIMIT = '100000';

const simulationLogsDir = path.resolve(repoRoot, 'src/server/logs/simulations');
const dataRecordersLogsDir = path.resolve(repoRoot, 'src/server/logs/data-recorders');
const dataStoragePath = path.resolve(repoRoot, 'src/server/data/data-storage.json');

const mongoHost = process.env.TAS_E2E_MONGO_HOST || '127.0.0.1';
const mongoPort = Number(process.env.TAS_E2E_MONGO_PORT || 27017);
const mqttHost = process.env.TAS_E2E_MQTT_HOST || '127.0.0.1';
const mqttPort = Number(process.env.TAS_E2E_MQTT_PORT || 1883);

/** Everything persisted by this suite lives in one throwaway database name. */
const DB_NAME = 'tas_e2e_phase4';

/** Availability probed once, before any test runs; false means "skip politely". */
let mongoUp = false;
let mqttUp = false;

/**
 * Scratch directories for the artifact stores behind `/api/models` and the
 * recorder endpoints. Nothing this suite stores may land in the repository's
 * own `src/server/data` trees, whatever the outcome.
 */
let modelsDir;
let recordersDir;

/**
 * The exact bytes of the tracked data-storage configuration as found. The
 * database-backed sections genuinely persist a working configuration through
 * the API (that is how the server's own routes reach the test database), so
 * the file is restored byte-for-byte afterwards.
 */
const dataStorageBaseline = fs.existsSync(dataStoragePath)
  ? fs.readFileSync(dataStoragePath, 'utf8')
  : null;

/** A schema-valid data-storage configuration pointing somewhere specific. */
const storageConfig = (host, port, dbname) => ({
  protocol: 'MONGODB',
  connConfig: { host, port, username: null, password: null, dbname, options: null },
});

/** The live test database, for runs that must actually store what they send. */
const liveStorage = () => storageConfig(mongoHost, mongoPort, DB_NAME);

/** A storage configuration that can never be reached. */
const deadStorage = () => storageConfig('127.0.0.1', 1, null);

/**
 * A topology whose single device REPLAYS a recorded dataset: no generator
 * sensors, streams only — the digital-twin shape `Thing.initDevice` serves
 * from `getAllEvents`.
 */
const replayTopology = (name, topicPattern) => ({
  name,
  devices: [
    {
      id: 'device-01',
      name: 'Replay Device',
      enable: true,
      scale: 1,
      behaviours: [],
      timeToFailed: 0,
      testBroker: {
        protocol: 'MQTT',
        connConfig: { host: mqttHost, port: mqttPort, options: null },
      },
      productionBroker: null,
      isReplayingStreams: true,
      sensors: [],
      actuators: [],
      upStreams: [topicPattern],
      downStreams: [],
    },
  ],
});

/**
 * A topology with one generator sensor behind an MQTT test broker: starts
 * producing without needing a database when handed an explicit (unreachable)
 * data storage.
 */
const generatingTopology = (name) => ({
  name,
  devices: [
    {
      id: 'device-01',
      name: 'Generating Device',
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
          id: 'phase4-sensor',
          objectId: null,
          name: 'Phase 4 Sensor',
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

/** An inline recorder model that stores everything it hears into `datasetId`. */
const recorderModel = (name, topicPattern, datasetId) => ({
  name,
  dataRecorders: [
    {
      id: 'recorder-01',
      name: 'Phase 4 Recorder',
      source: {
        protocol: 'MQTT',
        connConfig: { host: mqttHost, port: mqttPort, options: null },
        upStreams: [topicPattern],
        downStreams: [],
      },
      forward: null,
    },
  ],
  dataStorage: liveStorage(),
  dataset: {
    id: datasetId,
    name: `Recorded dataset ${datasetId}`,
    description: `Recorded by the issue #33 gate at ${new Date().toISOString()}`,
    tags: ['recorded'],
  },
});

/** Resolve a TCP endpoint quickly; a refused connection answers immediately. */
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

/** Poll an async predicate until it holds or the deadline passes. */
const eventually = async (probe, deadlineMs) => {
  const deadline = Date.now() + deadlineMs;
  while (Date.now() < deadline) {
    const result = await probe();
    if (result) return result;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return (await probe()) || false;
};

const removeIfPresent = (filePath) => {
  try {
    fs.unlinkSync(filePath);
  } catch (_) {
    /* absent, which is the expected case */
  }
};

/** Delete every run log this suite created for a topology or recorder name. */
const removeRunLogs = (name) => {
  for (const dir of [simulationLogsDir, dataRecordersLogsDir]) {
    let entries = [];
    try {
      entries = fs.readdirSync(dir);
    } catch (_) {
      continue; // absent, which is the expected case on a fresh checkout
    }
    for (const entry of entries) {
      if (entry.startsWith(`${name}_`)) removeIfPresent(path.join(dir, entry));
    }
  }
};

/** Stop a simulation through the API, tolerating an already-stopped registry. */
const stopRun = (baseUrl, name) =>
  request(baseUrl, 'GET', `/api/simulation/stop/${encodeURIComponent(name)}.json`);

/** Stop a data recorder through the API the way the dashboard does. */
const stopRecorder = (baseUrl, name) =>
  request(baseUrl, 'GET', `/api/data-recorders/stop/${encodeURIComponent(name)}.json`);

/** Restore the tracked data-storage file to the bytes it had on arrival. */
const restoreStorageBaseline = () => {
  if (dataStorageBaseline !== null && fs.existsSync(dataStoragePath)) {
    if (fs.readFileSync(dataStoragePath, 'utf8') !== dataStorageBaseline) {
      fs.writeFileSync(dataStoragePath, dataStorageBaseline);
    }
  }
};

/**
 * Remove every database document a workflow run created: its recorded events,
 * the replay's auto-created dataset and events, and the registered reports.
 * Pass `newDatasetId` when the run got far enough to name it.
 */
const cleanupWorkflowDocuments = async (mongoose, datasetId, newDatasetId = null) => {
  const datasetIds = newDatasetId ? [datasetId, newDatasetId] : [datasetId];
  await mongoose.connection.db.collection('events').deleteMany({ datasetId: { $in: datasetIds } });
  await mongoose.connection.db.collection('datasets').deleteMany({ id: { $in: datasetIds } });
  if (newDatasetId) {
    // The report references both sides by id; the topology file name is the
    // only other key it carries that this suite knows.
    await mongoose.connection.db.collection('reports').deleteMany({
      $or: [{ originalDatasetId: datasetId }, { newDatasetId }],
    });
  }
};

/**
 * Point the instance's tracked data storage at the live test database and
 * prove it connected — the same move section 5 of the lifecycle gate makes.
 * The tracked file is restored byte-for-byte by the caller.
 */
const pointStorageAtTestDatabase = async (baseUrl) => {
  const saved = await request(baseUrl, 'POST', '/api/data-storage', {
    body: { dataStorage: liveStorage() },
  });
  assert.equal(saved.status, 200, `the working configuration must be accepted: ${saved.raw}`);
};

before(async () => {
  modelsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tas-phase4-models-'));
  recordersDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tas-phase4-recorders-'));
  // Nothing under src/server/logs is created up front by the application.
  fs.mkdirSync(simulationLogsDir, { recursive: true });
  fs.mkdirSync(dataRecordersLogsDir, { recursive: true });
  [mongoUp, mqttUp] = await Promise.all([
    probeTcp(mongoHost, mongoPort),
    probeTcp(mqttHost, mqttPort),
  ]);
});

after(() => {
  if (modelsDir) fs.rmSync(modelsDir, { recursive: true, force: true });
  if (recordersDir) fs.rmSync(recordersDir, { recursive: true, force: true });
  // The tracked data-storage configuration must leave this suite exactly as
  // it entered it.
  try {
    if (
      dataStorageBaseline !== null &&
      fs.readFileSync(dataStoragePath, 'utf8') !== dataStorageBaseline
    ) {
      fs.writeFileSync(dataStoragePath, dataStorageBaseline);
    }
  } catch (_) {
    /* the file may never have existed; nothing this suite wrote survives that case */
  }
});

/** Server environment shared by every instance this suite spawns. */
const baseEnv = () => ({
  RATE_LIMIT_MAX: NO_RATE_LIMIT,
  TAS_MODELS_DIR: modelsDir,
  TAS_DATA_RECORDERS_DIR: recordersDir,
});

// ---------------------------------------------------------------------------
// 1. AC — two concurrent edits of the SAME topology do not silently discard
//    one another (issue #30's serialized artifact store, proven over HTTP)
// ---------------------------------------------------------------------------

test('two concurrent edits of one topology are both applied and land as one complete record', async () => {
  const server = await startServer(baseEnv());
  const name = unique('concurrent-edit');
  const fileName = `${name}.json`;
  try {
    const created = await request(server.baseUrl, 'POST', '/api/models', {
      body: { model: { name, devices: [] } },
    });
    assert.equal(created.status, 200, `the topology must be created first: ${created.raw}`);

    // Two editors read the same stored topology and save different changes
    // against the same file name at the same moment.
    const editA = {
      name,
      devices: [{ id: 'device-a', name: 'Editor A device', enable: true }],
    };
    const editB = {
      name,
      devices: [
        { id: 'device-b', name: 'Editor B device', enable: true },
        { id: 'device-b2', name: 'Editor B second device', enable: false },
      ],
    };
    const [resA, resB] = await Promise.all([
      request(server.baseUrl, 'POST', `/api/models/${encodeURIComponent(fileName)}`, {
        body: { model: editA },
      }),
      request(server.baseUrl, 'POST', `/api/models/${encodeURIComponent(fileName)}`, {
        body: { model: editB },
      }),
    ]);
    assert.equal(resA.status, 200, `editor A's save must be acknowledged: ${resA.raw}`);
    assert.equal(resB.status, 200, `editor B's save must be acknowledged: ${resB.raw}`);

    // Exactly one record exists under the name, and it is exactly ONE of the
    // two complete payloads — never a merge of fields from both, never a torn
    // document, never a leftover under a second name.
    const listed = await request(server.baseUrl, 'GET', '/api/models');
    assert.equal(listed.status, 200, `the listing must answer: ${listed.raw}`);
    const held = (listed.body.models || []).filter((entry) => entry === fileName);
    assert.deepEqual(held, [fileName], `exactly one record must exist: ${listed.raw}`);

    const readBack = await request(
      server.baseUrl,
      'GET',
      `/api/models/${encodeURIComponent(fileName)}`
    );
    assert.equal(readBack.status, 200, `the record must read back: ${readBack.raw}`);
    const final = readBack.body.model;
    const sameAs = (candidate) => {
      try {
        assert.deepEqual(final, candidate);
        return true;
      } catch (_) {
        return false;
      }
    };
    assert.ok(
      sameAs(editA) || sameAs(editB),
      `the final record must equal one editor's complete payload, not a blend: ${readBack.raw}`
    );
  } finally {
    await request(server.baseUrl, 'DELETE', `/api/models/${encodeURIComponent(fileName)}`);
    await server.stop();
  }
});

// ---------------------------------------------------------------------------
// 2. AC — data written by the pre-migration version is readable after the
//    migration: raw documents in the legacy shape, read back through the
//    migrated Mongoose layer and the HTTP API
// ---------------------------------------------------------------------------

test('events and datasets written before the migration are readable afterwards', async (t) => {
  if (!mongoUp) return t.skip('no reachable MongoDB to seed and read legacy documents from');
  const server = await startServer(baseEnv());
  const mongoose = require('mongoose');
  const datasetId = unique('legacy-ds');
  const base = Date.now() - 60000; // inside every default query window
  try {
    await pointStorageAtTestDatabase(server.baseUrl);

    // Seed EXACTLY as a writer bypassing today's stack would: raw documents
    // straight into the collections, no Mongoose casting or defaults — the
    // shape the pre-migration version left behind, legacy-only field included.
    await mongoose.connect(`mongodb://${mongoHost}:${mongoPort}`, { dbName: DB_NAME });
    const eventsCol = mongoose.connection.db.collection('events');
    const datasetsCol = mongoose.connection.db.collection('datasets');
    const legacyEvents = Array.from({ length: 6 }, (_, index) => ({
      datasetId,
      timestamp: base + index * 1000,
      topic: `legacy/room-${index % 2}`,
      isSensorData: true,
      values: { seq: index, unit: 'C' },
      isUpstream: true, // a field today's schemas never write
    }));
    await eventsCol.insertMany(legacyEvents);
    await datasetsCol.insertOne({
      id: datasetId,
      name: `Legacy dataset ${datasetId}`,
      description: 'Seeded in the pre-migration shape by the issue #33 gate',
      tags: ['recorded'],
      lastModified: base,
      source: 'RECORDED',
    });

    // The migrated schema statics read the raw documents.
    const { EventSchema } = require('../../src/core/enact-mongoose');
    const throughSchemas = await EventSchema.findEventsBetweenTimes(
      { datasetId },
      0,
      base + 600000
    );
    assert.equal(throughSchemas.length, 6, 'all six legacy events must be found');
    assert.deepEqual(
      throughSchemas.map((event) => event.values.seq),
      [0, 1, 2, 3, 4, 5],
      'legacy values must come back intact and in time order'
    );

    // And the API serves them the way the dashboard reads them.
    const viaApi = await request(
      server.baseUrl,
      'GET',
      `/api/events?datasetId=${encodeURIComponent(datasetId)}&startTime=0&endTime=${base + 600000}`
    );
    assert.equal(viaApi.status, 200, `the events endpoint must answer: ${viaApi.raw}`);
    assert.equal(viaApi.body.totalNbEvents, 6, `every legacy event must be served: ${viaApi.raw}`);

    const datasetsViaApi = await request(server.baseUrl, 'GET', '/api/data-sets');
    assert.equal(
      datasetsViaApi.status,
      200,
      `the datasets endpoint must answer: ${datasetsViaApi.raw}`
    );
    assert.ok(
      (datasetsViaApi.body.datasets || []).some((dataset) => dataset.id === datasetId),
      `the legacy dataset must be listed: ${datasetsViaApi.raw}`
    );
  } finally {
    await mongoose.disconnect().catch(() => {});
    try {
      await mongoose.connect(`mongodb://${mongoHost}:${mongoPort}`, { dbName: DB_NAME });
      await mongoose.connection.db.collection('events').deleteMany({ datasetId });
      await mongoose.connection.db.collection('datasets').deleteMany({ id: datasetId });
    } catch (_) {
      /* best-effort cleanup; the database itself is throwaway */
    }
    await mongoose.disconnect().catch(() => {});
    restoreStorageBaseline();
    await server.stop();
  }
});

// ---------------------------------------------------------------------------
// 3. AC — restarting the server MID-SIMULATION leaves the dashboard reporting
//    the correct running state (issue #29's registry, proven with real runs)
// ---------------------------------------------------------------------------

test('an unclean restart mid-simulation reports the run as no longer running', async (t) => {
  if (!mqttUp) return t.skip('needs a reachable MQTT broker so the device produces data');
  const storeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tas-phase4-restart-'));
  const storePath = path.join(storeDir, 'runtime-state.json');
  const env = {
    ...baseEnv(),
    TAS_RUNTIME_STATE_PATH: storePath,
    TAS_MQTT_HOST: mqttHost,
    TAS_MQTT_PORT: String(mqttPort),
  };
  const name = unique('midrun-unclean');
  let first;
  let second;
  try {
    first = await startServer(env);
    const started = await request(first.baseUrl, 'POST', '/api/simulation/start', {
      body: { model: generatingTopology(name), options: { dataStorage: deadStorage() } },
    });
    assert.equal(started.status, 200, `the run must start: ${started.raw}`);

    // Mid-simulation: the device really is producing before the server dies.
    const producing = await eventually(async () => {
      const res = await request(first.baseUrl, 'GET', '/api/simulation/stats');
      const rows = Array.isArray(res.body && res.body.stats) ? res.body.stats : [];
      return rows.reduce((total, row) => total + (row.numberOfSentData || 0), 0) > 0;
    }, 30000);
    assert.ok(producing, 'the run must be producing data before the restart');

    first.child.kill('SIGKILL');
    await new Promise((resolve) => {
      if (first.child.exitCode !== null) return resolve();
      first.child.once('exit', resolve);
    });

    second = await startServer(env);
    const status = await request(second.baseUrl, 'GET', '/api/simulation/status');
    assert.equal(status.status, 200, `status must be served after the restart: ${status.raw}`);
    const ghosts = Object.values(status.body.simulationStatus || {}).filter(
      (entry) => entry.model === name
    );
    assert.deepEqual(
      ghosts,
      [],
      `the orphaned run must not be reported as running after the restart: ${status.raw}`
    );
  } finally {
    if (second) await second.stop();
    else if (first && first.child.exitCode === null) await first.stop();
    removeRunLogs(name);
    fs.rmSync(storeDir, { recursive: true, force: true });
  }
});

test('a graceful restart mid-simulation reports the run as finished, not running', async (t) => {
  if (!mqttUp) return t.skip('needs a reachable MQTT broker so the device produces data');
  const storeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tas-phase4-restart-'));
  const storePath = path.join(storeDir, 'runtime-state.json');
  const env = {
    ...baseEnv(),
    TAS_RUNTIME_STATE_PATH: storePath,
    TAS_MQTT_HOST: mqttHost,
    TAS_MQTT_PORT: String(mqttPort),
  };
  const name = unique('midrun-clean');
  let first;
  let second;
  try {
    first = await startServer(env);
    const started = await request(first.baseUrl, 'POST', '/api/simulation/start', {
      body: { model: generatingTopology(name), options: { dataStorage: deadStorage() } },
    });
    assert.equal(started.status, 200, `the run must start: ${started.raw}`);

    const producing = await eventually(async () => {
      const res = await request(first.baseUrl, 'GET', '/api/simulation/stats');
      const rows = Array.isArray(res.body && res.body.stats) ? res.body.stats : [];
      return rows.reduce((total, row) => total + (row.numberOfSentData || 0), 0) > 0;
    }, 30000);
    assert.ok(producing, 'the run must be producing data before the restart');

    // Graceful stop mid-simulation: the shutdown takes its runs down with it.
    await first.stop();

    second = await startServer(env);
    const status = await request(second.baseUrl, 'GET', '/api/simulation/status');
    assert.equal(status.status, 200, `status must be served after the restart: ${status.raw}`);
    const ghosts = Object.values(status.body.simulationStatus || {}).filter(
      (entry) => entry.model === name
    );
    assert.deepEqual(ghosts, [], `a clean restart must report no running work: ${status.raw}`);
  } finally {
    if (second) await second.stop();
    else if (first && first.child.exitCode === null) await first.stop();
    removeRunLogs(name);
    fs.rmSync(storeDir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// 4. AC — the complete workflow: define a topology, record data, replay it in
//    a simulation, generate a report, and read its score
// ---------------------------------------------------------------------------

test('recording then replaying a dataset produces a scored report end to end', async (t) => {
  if (!mqttUp || !mongoUp) {
    return t.skip('needs a reachable MQTT broker and MongoDB for the full workflow');
  }
  const server = await startServer({
    ...baseEnv(),
    TAS_MQTT_HOST: mqttHost,
    TAS_MQTT_PORT: String(mqttPort),
  });
  const mongoose = require('mongoose');
  const topologyName = unique('phase4-topology');
  const recorderName = unique('phase4-recorder');
  const datasetId = unique('phase4-recorded');
  const topicRoot = `tas-e2e/${datasetId}`;
  const topicPattern = `${topicRoot}/#`;
  const sensorTopic = `${topicRoot}/sensor-01`;
  let brokerClient = null;
  let knownNewDatasetId = null;
  try {
    await pointStorageAtTestDatabase(server.baseUrl);

    // --- Step 1: define a topology through the API -------------------------
    const defined = await request(server.baseUrl, 'POST', '/api/models', {
      body: { model: replayTopology(topologyName, topicPattern) },
    });
    assert.equal(defined.status, 200, `the topology must be defined: ${defined.raw}`);
    const listing = await request(server.baseUrl, 'GET', '/api/models');
    assert.ok(
      (listing.body.models || []).includes(`${topologyName}.json`),
      `the defined topology must be listed: ${listing.raw}`
    );

    // --- Step 2: record real data through the data recorder ---------------
    const recording = await request(server.baseUrl, 'POST', '/api/data-recorders/start', {
      body: { model: recorderModel(recorderName, topicPattern, datasetId) },
    });
    assert.equal(recording.status, 200, `the recorder must start: ${recording.raw}`);
    assert.ok(
      Object.values(recording.body.status || {}).some(
        (entry) => entry.model === recorderName && entry.isRunning
      ),
      `the running recorder must be reported: ${recording.raw}`
    );

    brokerClient = await mqtt.connectAsync(`mqtt://${mqttHost}:${mqttPort}`);
    for (let sequence = 0; sequence < 6; sequence++) {
      await brokerClient.publishAsync(sensorTopic, JSON.stringify({ seq: sequence }));
      await new Promise((resolve) => setTimeout(resolve, 120));
    }

    await mongoose.connect(`mongodb://${mongoHost}:${mongoPort}`, { dbName: DB_NAME });
    const { EventSchema, ReportSchema } = require('../../src/core/enact-mongoose');
    const recorded = await eventually(async () => {
      const count = await EventSchema.countDocuments({ datasetId }).catch(() => 0);
      return count >= 6;
    }, 30000);
    assert.ok(recorded, 'the recorder must store every published reading');

    const stoppedRecorder = await stopRecorder(server.baseUrl, recorderName);
    assert.equal(stoppedRecorder.status, 200, `the recorder must stop: ${stoppedRecorder.raw}`);

    // --- Step 3: replay the recorded dataset in a simulation --------------
    // Started BY FILE NAME, so the stored topology is what drives the run.
    const started = await request(server.baseUrl, 'POST', '/api/simulation/start', {
      body: {
        modelFileName: `${topologyName}.json`,
        options: {
          dataStorage: liveStorage(),
          datasetId,
          replayOptions: { speedup: 5 },
          evaluationParameters: {
            threshold: 0.5,
            eventType: 'ALL_EVENTS',
            metricType: 'METRIC_VALUE',
          },
        },
      },
    });
    assert.equal(started.status, 200, `the simulation must start: ${started.raw}`);
    const entry = Object.values(started.body.simulationStatus || {}).find(
      (candidate) => candidate.model === topologyName
    );
    assert.ok(entry, `the run must be registered: ${started.raw}`);
    assert.equal(entry.isRunning, true, `the run must be running: ${started.raw}`);
    const newDatasetId = entry.newDataset && entry.newDataset.id;
    assert.ok(newDatasetId, `the run must own a new dataset: ${started.raw}`);
    knownNewDatasetId = newDatasetId;

    // --- Steps 4 + 5: the report is generated and its score is readable ---
    // A non-repeating replay finishes on its own; scoring writes the score
    // into the report the run registered.
    const scoredReport = await eventually(async () => {
      const report = await ReportSchema.findOne({ newDatasetId }).catch(() => null);
      return report && report.score > -1 ? report : null;
    }, 45000);
    assert.ok(scoredReport, 'the run must register its report and score it');
    assert.equal(
      scoredReport.originalDatasetId,
      datasetId,
      'the report must compare the recorded dataset'
    );

    const viaApi = await request(
      server.baseUrl,
      'GET',
      `/api/reports/${encodeURIComponent(scoredReport.id)}`
    );
    assert.equal(viaApi.status, 200, `the report endpoint must serve the report: ${viaApi.raw}`);
    assert.equal(viaApi.body.report.id, scoredReport.id, `the same report: ${viaApi.raw}`);
    assert.equal(
      viaApi.body.report.score,
      scoredReport.score,
      `the served score must match the stored one: ${viaApi.raw}`
    );
    // Every replayed value equals its recorded original, so the value metric
    // must score the single topic at 1 — the fraction of topics above the
    // threshold is then exactly 1.
    assert.equal(scoredReport.score, 1, 'a faithful replay of one topic must score 1');
  } finally {
    await stopRun(server.baseUrl, topologyName).catch(() => {});
    await stopRecorder(server.baseUrl, recorderName).catch(() => {});
    if (brokerClient) {
      // mqtt v5's `end` takes a callback; force-close so reconnect timers
      // cannot hold the runner open after the suite has finished.
      await new Promise((resolve) => brokerClient.end(true, {}, resolve));
    }
    try {
      await cleanupWorkflowDocuments(mongoose, datasetId, knownNewDatasetId);
    } catch (_) {
      /* best-effort cleanup; the database itself is throwaway */
    }
    await mongoose.disconnect().catch(() => {});
    restoreStorageBaseline();
    removeRunLogs(topologyName);
    removeRunLogs(recorderName);
    await server.stop();
  }
});
