/**
 * End-to-end deployment smoke test on the composed stack (issue #49) — the
 * Phase 6 milestone gate and the final gate of the improvement programme.
 *
 * Every other suite drives a server spawned by the test harness. This one
 * brings up the PUBLISHED COMPOSITION exactly as a new user would — the
 * documented quick start (`docker compose up -d`) from this checkout, with
 * credentials provisioned the way README.md documents — and asserts what the
 * preceding milestones established still holds in a real deployment:
 *
 *   - the quick start brings up a healthy three-service deployment (#45)
 *   - the dashboard, API health endpoint, authenticated broker and flow
 *     editor are each reachable
 *   - a complete workflow succeeds against the deployed stack: define a
 *     topology, run a producing simulation through the composition's internal
 *     broker listener, watch the data arrive, stop cleanly
 *   - restarting each service independently leaves the others running and
 *     everything recovers
 *   - the application process runs as a non-root user (#8) and the Phase 0
 *     containment assertions still hold against the deployed API
 *   - anonymous access is rejected across the deployed API (#9)
 *
 * The published-image vulnerability scan and the release wiring that makes
 * this suite block publication are pinned statically in
 * test/release-workflow.test.js and enforced by the release workflow itself.
 *
 * The suite is opt-in because it needs Docker and owns the checkout's compose
 * project (including its published host ports 3004, 1883 and 1880, which can
 * be moved with TAS_SMOKE_APP_PORT / TAS_SMOKE_MQTT_PORT /
 * TAS_SMOKE_NODERED_PORT when the host already owns them):
 *
 *   TAS_SMOKE_COMPOSE=1 node --test test/e2e/deployment-smoke.test.js
 *
 * Without it every runtime test skips with that reason, so plain `npm test`
 * stays green on a bare checkout. The release workflow sets the flag.
 */
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const net = require('node:net');
const crypto = require('node:crypto');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const mqtt = require('mqtt');

const repoRoot = path.resolve(__dirname, '../..');

const enabled = process.env.TAS_SMOKE_COMPOSE === '1';
const skipReason = 'set TAS_SMOKE_COMPOSE=1 to run the composed-deployment smoke test';

/** Where the composition publishes each service on the host (README table). */
const mqttHost = process.env.TAS_SMOKE_MQTT_HOST || '127.0.0.1';
const hostBrokerPort = Number(process.env.TAS_SMOKE_MQTT_PORT || 1883);
const hostAppPort = Number(process.env.TAS_SMOKE_APP_PORT || 3004);
const hostNoderedPort = Number(process.env.TAS_SMOKE_NODERED_PORT || 1880);
const appUrl = process.env.TAS_SMOKE_APP_URL || `http://127.0.0.1:${hostAppPort}`;
const noderedUrl = process.env.TAS_SMOKE_NODERED_URL || `http://127.0.0.1:${hostNoderedPort}`;
const mqttPort = hostBrokerPort;

/**
 * Broker account seeded on first start (README quick-start defaults) and the
 * administrator credential provisioned for the application.
 */
const brokerUsername = process.env.TAS_SMOKE_MOSQUITTO_USERNAME || 'tas';
const brokerPassword = process.env.TAS_SMOKE_MOSQUITTO_PASSWORD || 'change-me-broker';
const adminUsername = process.env.TAS_SMOKE_ADMIN_USERNAME || 'smoke-admin';
const adminPassword = process.env.TAS_SMOKE_ADMIN_PASSWORD || 'tas-smoke-admin-password';

/** Polling cadence: gentle enough to stay far below the default API limit. */
const POLL_INTERVAL_MS = 750;
const READY_TIMEOUT_MS = 180000;
const RECOVER_TIMEOUT_MS = 60000;
const PRODUCE_TIMEOUT_MS = 30000;

let broughtUp = false;
let authHeaders = null;

// ---------------------------------------------------------------------------
// Composition and HTTP helpers
// ---------------------------------------------------------------------------

function compose(args, { env = {}, ignoreFailure = false } = {}) {
  try {
    return execFileSync('docker', ['compose', ...args], {
      cwd: repoRoot,
      env: { ...process.env, ...env },
      encoding: 'utf8',
    }).trim();
  } catch (error) {
    if (ignoreFailure) return null;
    throw error;
  }
}

/** Container id of one compose service (empty when it has none). */
const containerId = (service) => compose(['ps', '-q', service], { ignoreFailure: true }) || '';

function inspect(service, format) {
  const id = containerId(service);
  if (!id) return null;
  return execFileSync('docker', ['inspect', '--format', format, id], {
    encoding: 'utf8',
  }).trim();
}

/** Running state plus health and start time for one long-running service. */
function serviceState(service) {
  return {
    running: inspect(service, '{{.State.Running}}') === 'true',
    healthy: inspect(service, '{{.State.Health.Status}}'),
    startedAt: inspect(service, '{{.State.StartedAt}}'),
  };
}

const serviceStates = () =>
  Object.fromEntries(['app', 'broker', 'nodered'].map((s) => [s, serviceState(s)]));

function request(base, method, requestPath, { body, headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(requestPath, base);
    const data = body ? JSON.stringify(body) : null;
    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: `${url.pathname}${url.search}`,
        method,
        headers: {
          ...(data ? { 'Content-Type': 'application/json' } : {}),
          ...headers,
        },
      },
      (res) => {
        let raw = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          raw += chunk;
        });
        res.on('end', () => {
          let parsed = null;
          try {
            parsed = JSON.parse(raw);
          } catch (_) {
            /* not JSON */
          }
          resolve({ status: res.statusCode, headers: res.headers, raw, body: parsed });
        });
      }
    );
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

/** Poll a predicate (sync or async) until it holds or the deadline passes. */
async function eventually(probe, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const result = await Promise.resolve()
      .then(probe)
      .catch(() => false);
    if (result) return result;
    if (Date.now() >= deadline) {
      return (
        (await Promise.resolve()
          .then(probe)
          .catch(() => false)) || false
      );
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}

function tcpOpen(host, port, timeoutMs = 1500) {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });
    const settle = (answer) => {
      socket.destroy();
      resolve(answer);
    };
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => settle(true));
    socket.once('timeout', () => settle(false));
    socket.once('error', () => settle(false));
  });
}

/**
 * Connect to the published broker listener with credentials and prove the
 * connection carries traffic: subscribe, publish, receive.
 */
function authenticatedRoundtrip(topic) {
  return new Promise((resolve, reject) => {
    const client = mqtt.connect(`mqtt://${mqttHost}:${mqttPort}`, {
      username: brokerUsername,
      password: brokerPassword,
      connectTimeout: 10000,
      reconnectPeriod: 0,
    });
    const fail = (error) => {
      client.end(true);
      reject(error);
    };
    client.on('error', fail);
    client.on('connect', () => {
      client.subscribe(topic, (subscribeError) => {
        if (subscribeError) return fail(subscribeError);
        client.publish(topic, 'smoke', (publishError) => {
          if (publishError) return fail(publishError);
        });
      });
    });
    client.on('message', (received, payload) => {
      client.end(true, {}, () =>
        received === topic && String(payload) === 'smoke'
          ? resolve()
          : reject(new Error(`roundtrip mismatch on ${received}`))
      );
    });
    setTimeout(() => fail(new Error('broker roundtrip timed out')), 15000);
  });
}

/** An MQTT connect attempt as a boolean outcome instead of a thrown error. */
function mqttConnectSucceeds(options) {
  return new Promise((resolve) => {
    const client = mqtt.connect(`mqtt://${mqttHost}:${mqttPort}`, {
      connectTimeout: 5000,
      reconnectPeriod: 0,
      ...options,
    });
    client.once('connect', () => {
      client.end(true);
      resolve(true);
    });
    client.once('close', () => resolve(false));
    client.once('error', () => resolve(false));
  });
}

/** Log in to the deployed app and return the session headers for later calls. */
async function logIn() {
  const res = await request(appUrl, 'POST', '/api/auth/login', {
    body: { username: adminUsername, password: adminPassword },
  });
  assert.equal(res.status, 200, `deployed login must succeed: ${res.raw}`);
  assert.ok(res.body && res.body.csrfToken, `expected a CSRF token: ${res.raw}`);
  const cookie = (res.headers['set-cookie'] || []).map((c) => c.split(';')[0]).join('; ');
  return { Cookie: cookie, 'X-CSRF-Token': res.body.csrfToken };
}

/** True when every long-running service answers the way README promises. */
async function stackHealthy() {
  const health = await request(appUrl, 'GET', '/api/health');
  if (health.status !== 200) return false;
  if (!(await tcpOpen(mqttHost, mqttPort))) return false;
  const editor = await request(noderedUrl, 'GET', '/');
  return editor.status >= 200 && editor.status < 400;
}

/**
 * A topology with one generator sensor behind the composition's internal
 * listener: starts producing without needing a database, exactly like the
 * Phase 4 gate's generating topology. Document defaults keep their historical
 * localhost shape; the deployed app resolves them through TAS_MQTT_* (#45).
 */
const generatingTopology = (name) => ({
  name,
  devices: [
    {
      id: 'device-01',
      name: 'Smoke Generator',
      enable: true,
      scale: 1,
      behaviours: [],
      timeToFailed: 0,
      testBroker: {
        protocol: 'MQTT',
        connConfig: { host: '127.0.0.1', port: 1884, options: null },
      },
      productionBroker: null,
      isReplayingStreams: false,
      sensors: [
        {
          id: 'smoke-sensor',
          objectId: null,
          name: 'Smoke Sensor',
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

/** A storage configuration that can never be reached, so nothing persists. */
const deadStorage = () => ({
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

const stopRun = (name) =>
  request(appUrl, 'GET', `/api/simulation/stop/${encodeURIComponent(name)}.json`, {
    headers: authHeaders,
  });

// ---------------------------------------------------------------------------

before(async () => {
  if (!enabled) return;
  // Fail fast with a readable message when Docker is missing entirely.
  execFileSync('docker', ['compose', 'version'], { stdio: 'pipe' });

  // A crashed earlier run of this suite (or a quick start the operator
  // abandoned) leaves this project's containers and volumes behind; they
  // would collide with the clean start under test. Recover the project to a
  // pristine state — this touches only this checkout's compose project.
  if (compose(['ps', '-q'], { ignoreFailure: true })) {
    compose(['down', '-v', '--remove-orphans'], { ignoreFailure: true });
  }

  // Provision exactly as README.md documents for real use: hash the password
  // where it is set, hand compose only the scrypt digest and a session secret.
  // docker-compose.yml interpolates all three from the calling environment,
  // alongside the movable published host ports.
  const hash = require(`${repoRoot}/src/server/auth/passwords`).hashPassword(adminPassword);
  // Flag before bringing anything up: whatever fails below, the after hook
  // must always tear this project back down instead of stranding containers.
  broughtUp = true;
  compose(['up', '-d'], {
    env: {
      SESSION_SECRET: crypto.randomBytes(32).toString('hex'),
      AUTH_ADMIN_USERNAME: adminUsername,
      AUTH_ADMIN_PASSWORD_HASH: hash,
      MOSQUITTO_USERNAME: brokerUsername,
      MOSQUITTO_PASSWORD: brokerPassword,
      TAS_HOST_BROKER_PORT: String(hostBrokerPort),
      TAS_HOST_APP_PORT: String(hostAppPort),
      TAS_HOST_NODERED_PORT: String(hostNoderedPort),
    },
  });

  const ready = await eventually(async () => {
    const health = await request(appUrl, 'GET', '/api/health').catch(() => null);
    return Boolean(health && health.status === 200) && (await tcpOpen(mqttHost, mqttPort));
  }, READY_TIMEOUT_MS);
  assert.ok(ready, 'the quick-start deployment never became reachable');
});

after(() => {
  if (!enabled || !broughtUp) return;
  compose(['down', '-v', '--remove-orphans'], { ignoreFailure: true });
});

// ---------------------------------------------------------------------------
// AC1 + AC2 — the documented quick start brings up a working, healthy stack
// ---------------------------------------------------------------------------

test(
  'quick start: the three services are up and healthy',
  { skip: !enabled && skipReason },
  async () => {
    // `up -d` returns as soon as containers start; each service's readiness
    // probe has its own start period. A working deployment is one whose
    // health checks are green, so wait for that.
    const healthy = await eventually(
      () => ['app', 'broker', 'nodered'].every((s) => serviceState(s).healthy === 'healthy'),
      READY_TIMEOUT_MS
    );
    assert.ok(healthy, 'the three services must report healthy from their own probes');
    const states = serviceStates();
    for (const service of ['app', 'broker', 'nodered']) {
      assert.ok(states[service].running, `${service} container must be running`);
      assert.equal(
        states[service].healthy,
        'healthy',
        `${service} must report healthy from its own readiness probe`
      );
    }
  }
);

test(
  'dashboard: the deployed app serves the dashboard over HTTP',
  { skip: !enabled && skipReason },
  async () => {
    const res = await request(appUrl, 'GET', '/');
    assert.equal(res.status, 200, `the dashboard root must answer: ${res.raw.slice(0, 200)}`);
    assert.match(
      String(res.headers['content-type'] || ''),
      /text\/html/,
      'the dashboard root must be HTML'
    );
  }
);

test(
  'api: the deployed app reports readiness on /api/health',
  { skip: !enabled && skipReason },
  async () => {
    const res = await request(appUrl, 'GET', '/api/health');
    assert.equal(res.status, 200, `health must answer 200: ${res.raw}`);
    assert.equal(res.body && res.body.status, 'ok', `health must report ok: ${res.raw}`);
  }
);

test(
  'broker: the published listener authenticates clients and carries traffic',
  { skip: !enabled && skipReason },
  async () => {
    // The published 1883 refuses anonymous access by policy (issue #46).
    assert.ok(
      !(await mqttConnectSucceeds({})),
      'the published broker listener must refuse anonymous access'
    );
    // And the authenticated quick-start account carries real traffic.
    await authenticatedRoundtrip('tas-smoke/broker-roundtrip');
  }
);

test(
  'flow editor: Node-RED serves the editor with the demo flow preloaded',
  { skip: !enabled && skipReason },
  async () => {
    const res = await request(noderedUrl, 'GET', '/');
    assert.equal(res.status, 200, `the flow editor root must answer: ${res.raw.slice(0, 200)}`);
    const flows = await request(noderedUrl, 'GET', '/flows');
    assert.equal(flows.status, 200, `the flows API must answer: ${flows.raw.slice(0, 200)}`);
    assert.ok(Array.isArray(flows.body), 'the flows API must return the flow array');
    assert.ok(flows.body.length > 0, 'the demo flow must be preloaded into the editor');
  }
);

// ---------------------------------------------------------------------------
// AC6 — anonymous access is rejected across the deployed API
// ---------------------------------------------------------------------------

test(
  'anonymous access is rejected across the deployed API',
  { skip: !enabled && skipReason },
  async () => {
    const families = [
      '/api/models/',
      '/api/data-recorders/',
      '/api/data-sets',
      '/api/reports/',
      '/api/logs/test-campaigns',
      '/api/simulation/status',
      '/api/devops',
    ];
    for (const family of families) {
      const res = await request(appUrl, 'GET', family);
      assert.equal(res.status, 401, `anonymous GET ${family} must be rejected (${res.raw})`);
    }
    const badLogin = await request(appUrl, 'POST', '/api/auth/login', {
      body: { username: adminUsername, password: 'definitely-wrong' },
    });
    assert.equal(badLogin.status, 401, `a wrong password must be rejected: ${badLogin.raw}`);
    // The liveness probe stays public by design — it is what tells operators
    // and the health checks that the process is up before there is a session.
    const health = await request(appUrl, 'GET', '/api/health');
    assert.equal(health.status, 200, '/api/health stays on the public allowlist');
  }
);

// ---------------------------------------------------------------------------
// AC3 — a complete workflow succeeds against the deployed stack
// ---------------------------------------------------------------------------

test(
  'complete workflow: define a topology and run a producing simulation on the deployed stack',
  { skip: !enabled && skipReason },
  async () => {
    authHeaders = await logIn();
    const name = `tas-smoke-topology-${Date.now()}`;
    const fileName = `${name}.json`;
    try {
      const defined = await request(appUrl, 'POST', '/api/models', {
        headers: authHeaders,
        body: { model: generatingTopology(name) },
      });
      assert.equal(defined.status, 200, `the topology must be created: ${defined.raw}`);

      const started = await request(appUrl, 'POST', '/api/simulation/start', {
        headers: authHeaders,
        body: { modelFileName: fileName, options: { dataStorage: deadStorage() } },
      });
      assert.equal(started.status, 200, `the simulation must start: ${started.raw}`);

      // The device inside the app container produces through the composition's
      // internal broker listener (TAS_MQTT_HOST=broker, port 1884): stats are
      // the end-to-end proof that the deployed wiring really carries data.
      const producing = await eventually(async () => {
        const stats = await request(appUrl, 'GET', '/api/simulation/stats', {
          headers: authHeaders,
        });
        const rows = Array.isArray(stats.body && stats.body.stats) ? stats.body.stats : [];
        return rows.reduce((total, row) => total + (row.numberOfSentData || 0), 0) > 0;
      }, PRODUCE_TIMEOUT_MS);
      assert.ok(producing, 'the deployed simulation must produce data end to end');

      const stopped = await stopRun(name);
      assert.equal(stopped.status, 200, `the simulation must stop cleanly: ${stopped.raw}`);
      const drained = await eventually(async () => {
        const status = await request(appUrl, 'GET', '/api/simulation/status', {
          headers: authHeaders,
        });
        const entries = Object.values((status.body && status.body.simulationStatus) || {});
        return !entries.some((entry) => entry.model === name && entry.isRunning);
      }, RECOVER_TIMEOUT_MS);
      assert.ok(drained, 'the stopped run must leave the registry reporting truthfully');
    } finally {
      await stopRun(name).catch(() => {});
      await request(appUrl, 'DELETE', `/api/models/${encodeURIComponent(fileName)}`, {
        headers: authHeaders,
      }).catch(() => {});
    }
  }
);

// ---------------------------------------------------------------------------
// AC4 — restarting each service independently leaves the others running
// ---------------------------------------------------------------------------

for (const restart of ['broker', 'nodered', 'app']) {
  const others = ['app', 'broker', 'nodered'].filter((s) => s !== restart);
  test(
    `restarting ${restart} leaves the other services running and everything recovers`,
    { skip: !enabled && skipReason },
    async () => {
      const before = serviceStates();
      for (const service of ['app', 'broker', 'nodered']) {
        assert.ok(before[service].running, `${service} must be running before the restart`);
      }

      compose(['restart', restart]);

      // Untouched containers were never stopped: same state AND same start
      // time — `docker compose restart` replaces the restarted service's
      // StartedAt and nobody else's.
      const after_ = serviceStates();
      for (const service of others) {
        assert.ok(after_[service].running, `${service} must still be running`);
        assert.equal(
          after_[service].startedAt,
          before[service].startedAt,
          `${service} must not have been restarted alongside ${restart}`
        );
      }

      const recovered = await eventually(stackHealthy, RECOVER_TIMEOUT_MS);
      assert.ok(recovered, `the stack must recover after restarting ${restart}`);
    }
  );
}

// ---------------------------------------------------------------------------
// AC5 — non-root application process; Phase 0 containment still holds
// ---------------------------------------------------------------------------

test('the application process runs as a non-root user', { skip: !enabled && skipReason }, () => {
  const uid = compose(['exec', '-T', 'app', 'id', '-u']);
  assert.notEqual(uid, '0', 'the application process must not run as root');
  const user = compose(['exec', '-T', 'app', 'id', '-un']);
  assert.equal(user, 'node', `the application process must run as node, got ${user}`);
});

test(
  'Phase 0 containment: traversal payloads are rejected by the deployed API',
  { skip: !enabled && skipReason },
  async () => {
    // Fresh session: the independent-restart legs above restarted the app,
    // and its in-memory session store does not outlive its own container.
    authHeaders = await logIn();
    const probes = [
      '/api/models/..%2Fpackage.json',
      '/api/models/%2e%2e%2fpackage.json',
      '/api/data-recorders/models/..%2Fpackage.json',
      '/api/logs/test-campaigns/..%2Fpackage.json',
    ];
    for (const probe of probes) {
      const res = await request(appUrl, 'GET', probe, { headers: authHeaders });
      assert.equal(res.status, 400, `traversal GET ${probe} must be rejected (${res.raw})`);
      assert.ok(!res.raw.includes('package.json'), `must not leak the target: ${res.raw}`);
      assert.ok(!res.raw.includes('/home/'), `must not leak server paths: ${res.raw}`);
    }
    const hostileCreate = await request(appUrl, 'POST', '/api/models', {
      headers: authHeaders,
      body: { model: { name: '../../pwned', devices: [] } },
    });
    assert.equal(
      hostileCreate.status,
      400,
      `a hostile model name must be rejected: ${hostileCreate.raw}`
    );
  }
);
