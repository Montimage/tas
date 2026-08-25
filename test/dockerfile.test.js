const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

// Container regression guard (issues #8, #42, #46, #76, #45).
//
// Since #45 the deployment is three images wired by docker-compose.yml:
//   - Dockerfile builds the APPLICATION image only (no broker, no editor,
//     no supervisor),
//   - deploy/compose/broker.conf states the broker policy for the
//     composition (the standalone policy stays in mosquitto.conf).
// The assertions below keep every one of those properties from regressing.
const REPO = path.join(__dirname, '..');
const dockerfile = fs.readFileSync(`${REPO}/Dockerfile`, 'utf8');
const compose = fs.readFileSync(`${REPO}/docker-compose.yml`, 'utf8');
const dockerignore = fs.readFileSync(`${REPO}/.dockerignore`, 'utf8');
const brokerConfPath = fs.existsSync(`${REPO}/mosquitto.conf`) ? `${REPO}/mosquitto.conf` : null;
const brokerConf = brokerConfPath ? fs.readFileSync(brokerConfPath, 'utf8') : '';
const composedBrokerConfPath = `${REPO}/deploy/compose/broker.conf`;
const composedBrokerConf = fs.readFileSync(composedBrokerConfPath, 'utf8');

const SUPPORTED_NODE_LTS = [20, 22, 24];

test('base image is a Node LTS still in security support', () => {
  const m = dockerfile.match(/^FROM\s+node:([0-9]+)-alpine/m);
  assert.ok(m, 'Dockerfile must use a node:<major>-alpine base image');
  const major = Number(m[1]);
  assert.ok(SUPPORTED_NODE_LTS.includes(major), `node:${major} is not a supported Node LTS`);
});

test('production install uses the committed lockfile (npm ci)', () => {
  assert.match(dockerfile, /npm ci/, 'Dockerfile must install from the lockfile');
  assert.match(
    dockerfile,
    /npm ci\s+--only=production|npm ci\s+--omit=dev/,
    'production install must omit devDependencies'
  );
});

test('the image runs as a non-root user', () => {
  assert.match(dockerfile, /^USER\s+(node|\d+)/m, 'Dockerfile must switch to an unprivileged USER');
  assert.ok(!/^USER\s+root\b/m.test(dockerfile), 'Dockerfile must not run as root');
});

test('runtime-writable locations are owned by the unprivileged user', () => {
  assert.match(
    dockerfile,
    /chown\s+-R\s+node:node/,
    'app and runtime dirs must be chowned to node'
  );
});

// --- Issue #45: the application ships alone ---

test('the application image carries only the app and its own dependencies', () => {
  // No broker, no flow editor and no process supervisor may be installed or
  // launched by the application image; they are separate services in the
  // composition.
  assert.ok(
    !/apk\s+[^&\n]*\b(mosquitto|supervisor)\b/.test(dockerfile),
    'Dockerfile must not install mosquitto or supervisor'
  );
  assert.ok(
    !/npm\s+install\s+-g[^&\n]*node-red/.test(dockerfile),
    'Dockerfile must not install node-red globally'
  );
  for (const banned of ['supervisord', 'node-red']) {
    assert.ok(
      !new RegExp(`^CMD\\s+\\[.*${banned}`, 'm').test(dockerfile),
      `Dockerfile CMD must not launch ${banned}`
    );
  }
});

test('the retired single-container supervisor is gone', () => {
  assert.ok(
    !fs.existsSync(`${REPO}/supervisord.conf`),
    'supervisord.conf must not come back — the composition replaced it'
  );
});

test('the supervised app process is given NODE_ENV=production (issue #76)', () => {
  assert.match(
    dockerfile,
    /^ENV\s+NODE_ENV=production\s*$/m,
    'the image must run in production mode (npm start equivalent)'
  );
});

test('the application image declares its readiness probe (issue #45)', () => {
  assert.match(dockerfile, /^HEALTHCHECK/m, 'Dockerfile must declare a HEALTHCHECK');
  assert.match(dockerfile, /api\/health/, 'the health check must hit /api/health');
});

test('composition artifacts are excluded from the application build context', () => {
  const lines = dockerignore.split('\n').map((l) => l.trim());
  for (const entry of ['docker-compose.yml', 'deploy/', 'node-red-flows/', 'mosquitto.conf']) {
    assert.ok(lines.includes(entry), `.dockerignore must exclude ${entry} from the app image`);
  }
});

// --- Issue #45: the composition wires three independently restartable services ---

test('the composition defines the three services plus the one-shot seeder', () => {
  for (const service of ['broker-init:', 'broker:', 'app:', 'nodered:']) {
    assert.ok(compose.includes(`\n  ${service}`), `docker-compose.yml must define ${service}`);
  }
});

function serviceBlock(name) {
  const idx = compose.indexOf(`\n  ${name}:`);
  assert.ok(idx !== -1, `service ${name} missing`);
  const rest = compose.slice(idx + 1);
  const next = rest.slice(3).search(/\n {2}[a-z-]+:/) + 3;
  return next === 2 ? rest : rest.slice(0, next);
}

test('every long-running service declares a health check', () => {
  for (const service of ['broker', 'app', 'nodered']) {
    assert.match(serviceBlock(service), /healthcheck:/, `${service} must declare a health check`);
  }
  // The one-shot credential seeder exits on purpose; it must NOT be declared
  // unhealthy while doing so.
  assert.ok(
    !/healthcheck:/.test(serviceBlock('broker-init')),
    'broker-init is one-shot and needs no health check'
  );
});

test('every long-running service restarts independently', () => {
  for (const service of ['broker', 'app', 'nodered']) {
    assert.match(
      serviceBlock(service),
      /restart:\s*unless-stopped/,
      `${service} must carry a restart policy of its own`
    );
  }
  assert.match(
    serviceBlock('broker-init'),
    /restart:\s*['"]no['"]/,
    'the one-shot seeder must not restart'
  );
});

test('startup order follows health, not guesswork', () => {
  assert.match(
    serviceBlock('broker'),
    /depends_on:[\s\S]*broker-init:[\s\S]*condition:\s*service_completed_successfully/,
    'the broker must wait for its password file to be seeded'
  );
  for (const service of ['app', 'nodered']) {
    assert.match(
      serviceBlock(service),
      /depends_on:[\s\S]*broker:[\s\S]*condition:\s*service_healthy/,
      `${service} must wait until the broker reports healthy`
    );
  }
});

test('only the loopback-bound authenticated broker listener is published to the host', () => {
  // The published host side is movable for busy machines (issue #49) but the
  // default stays 1883 and the container side never changes.
  assert.match(
    serviceBlock('broker'),
    /-\s*['"]127\.0\.0\.1:\$\{TAS_HOST_BROKER_PORT:-1883\}:1883['"]/,
    'the broker must publish 1883 on the host loopback interface'
  );
  // Every published mapping of every service binds its host side to
  // loopback: the composition is a local stack by default and the README
  // forbids publishing these ports to 0.0.0.0. Operators override for
  // trusted-network deployments.
  for (const service of ['broker', 'app', 'nodered']) {
    const maps = serviceBlock(service).match(/-\s*['"][^'"]+:\d+['"]/g) || [];
    assert.ok(maps.length > 0, `${service} must publish at least one port`);
    for (const mapping of maps) {
      assert.match(
        mapping,
        /^-\s*['"]127\.0\.0\.1:/,
        `${service} published port must bind loopback (${mapping})`
      );
    }
  }
  // Only quoted host:container mappings count as publications; prose comments
  // mention the internal port by name.
  const published = (serviceBlock('broker').match(/-\s*['"][^'"]+:\d+['"]/g) || []).join('\n');
  assert.ok(!/\b1884\b/.test(published), 'the anonymous internal listener must never be published');
  assert.match(
    composedBrokerConf,
    /^listener\s+1884\s+0\.0\.0\.0\b/m,
    'the internal listener must bind the compose network (a loopback bind cannot serve other containers)'
  );
});

test('the composition resolves cross-container broker addresses through env', () => {
  for (const service of ['app', 'nodered']) {
    const block = serviceBlock(service);
    assert.match(
      block,
      /TAS_MQTT_HOST:\s*broker/,
      `${service} must point TAS_MQTT_HOST at the broker service`
    );
    assert.match(
      block,
      /TAS_MQTT_PORT:\s*['"]1884['"]/,
      `${service} must use the internal listener port`
    );
  }
  const demoFlow = JSON.parse(
    fs.readFileSync(`${REPO}/node-red-flows/202402-temperature-controller.json`, 'utf8')
  );
  const brokerNodes = demoFlow.filter((n) => n.type === 'mqtt-broker');
  assert.ok(brokerNodes.length > 0, 'the demo flow must configure a broker');
  for (const node of brokerNodes) {
    assert.equal(
      node.broker,
      '${TAS_MQTT_HOST}',
      'flow broker address must resolve from the environment'
    );
    assert.equal(
      node.port,
      '${TAS_MQTT_PORT}',
      'flow broker port must resolve from the environment'
    );
  }
});

// --- Issues #46/#45: broker credentials stay out of the repository ---

test('dev-only artifacts and .env are excluded from the image build context', () => {
  const lines = dockerignore.split('\n').map((l) => l.trim());
  assert.ok(lines.includes('node_modules/'), '.dockerignore must exclude node_modules');
  assert.ok(lines.includes('.env'), '.dockerignore must exclude .env');
});

test('both committed broker policies authenticate their exposed listener', () => {
  for (const [label, conf] of [
    ['mosquitto.conf', brokerConf],
    ['deploy/compose/broker.conf', composedBrokerConf],
  ]) {
    assert.match(conf, /^listener\s+1883\b/m, `${label} must declare the exposed listener on 1883`);
    // mosquitto >= 2.1 scopes anonymous access per listener with the
    // listener_-prefixed form; the bare form is the pre-2.1 spelling.
    assert.match(
      conf,
      /^(listener_)?allow_anonymous\s+false\b/m,
      `${label}: the exposed listener must refuse anonymous access`
    );
    assert.match(
      conf,
      /^password_file\s+\S+/m,
      `${label}: the exposed listener must check credentials against a password file`
    );
    assert.match(conf, /^persistence\s+true\b/m, `${label}: persistence must be stated explicitly`);
  }
});

test('the internal listener allows anonymous clients only where it is unreachable from outside', () => {
  // Standalone policy: loopback inside the broker's own container.
  assert.match(
    brokerConf,
    /^listener\s+1884\s+127\.0\.0\.1\b/m,
    'standalone internal listener must stay bound to loopback'
  );
  const standaloneInternal = brokerConf.split(/^listener\s+1884.*$/m)[1];
  assert.ok(standaloneInternal, 'an internal listener must exist for co-located processes');
  assert.match(
    standaloneInternal.split(/^listener\s/m)[0],
    /^(listener_)?allow_anonymous\s+true\b/m,
    'the internal listener allows anonymous local clients'
  );

  // Composed policy: the compose network only (never published — asserted above).
  const composedInternal = composedBrokerConf.split(/^listener\s+1884.*$/m)[1];
  assert.ok(composedInternal, 'the composed policy must keep an internal listener');
  assert.match(
    composedInternal.split(/^listener\s/m)[0],
    /^(listener_)?allow_anonymous\s+true\b/m,
    'the composed internal listener serves the composition anonymously'
  );
});

test('broker credentials are supplied at runtime, never committed', () => {
  // The password file path lives outside the build context so an operator
  // mounts or seeds it at runtime; nothing credential-like may ship in the
  // repo or an image build context.
  for (const [label, conf] of [
    ['mosquitto.conf', brokerConf],
    ['deploy/compose/broker.conf', composedBrokerConf],
  ]) {
    assert.match(
      conf,
      /^password_file\s+\/run\/mosquitto\/passwd$/m,
      `${label}: the password file must be read from a runtime mount point`
    );
  }
  const credentialish = /^mosquitto(\.passwd|_passwd|.*credentials)/i;
  // Guard what is actually tracked (what would ship), not scratch files a
  // local checkout may legitimately carry while following the README.
  let tracked = null;
  try {
    tracked = execFileSync('git', ['ls-files'], { cwd: REPO, encoding: 'utf8' }).split('\n');
  } catch (_) {
    tracked = null; // no git available; the ignore-rule assertions below still hold
  }
  if (tracked) {
    const offenders = tracked.filter((f) => credentialish.test(f.trim()));
    assert.deepEqual(
      offenders,
      [],
      `no broker credential artifact may be committed (${offenders.join(', ')})`
    );
  }
  for (const [file, mustInclude] of [
    ['.gitignore', 'mosquitto.passwd'],
    ['.dockerignore', 'mosquitto.passwd'],
  ]) {
    const lines = fs
      .readFileSync(`${REPO}/${file}`, 'utf8')
      .split('\n')
      .map((l) => l.trim());
    assert.ok(
      lines.some((l) => !l.startsWith('#') && l.includes('mosquitto.passwd')),
      `${file} must exclude mosquitto.passwd so credentials are ${
        mustInclude === '.gitignore' ? 'never committed' : 'never baked into the image'
      }`
    );
  }
});

test('in-container consumers never dial the authenticated listener anonymously', () => {
  // Everything that talks to its own broker can only use the anonymous
  // internal listener: the published 1883 refuses anonymous access by
  // policy, so a client silently pointing there stops publishing (issue #46).
  // Cross-container addressing goes through TAS_MQTT_* env overrides (#45).
  const consumers = [
    'node-red-flows/202402-temperature-controller.json',
    'src/server/data/models/202402-Temperature-Controller.json',
    'src/server/data/data-recorders/TemperatureControllerRecorder.json',
    'src/core/gateways/gw-01.json',
    'src/core/gateways/gw-config.json',
  ];
  // Collected per file rather than thrown on the first hit, so a fix shows
  // every remaining offender at once.
  const walk = (node, offenders) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      node.forEach((child) => walk(child, offenders));
      return;
    }
    const local = ['host', 'HOST', 'broker'].some(
      (k) => typeof node[k] === 'string' && /^(localhost|127\.0\.0\.1)$/.test(node[k])
    );
    const authed = ['port', 'PORT'].some((k) => String(node[k]) === '1883');
    if (local && authed) offenders.push('localhost:1883');
    Object.values(node).forEach((value) => walk(value, offenders));
  };
  for (const rel of consumers) {
    const offenders = [];
    walk(JSON.parse(fs.readFileSync(`${REPO}/${rel}`, 'utf8')), offenders);
    assert.deepEqual(
      offenders,
      [],
      `${rel} must not point co-located processes at anonymous localhost:1883 — ` +
        'use the internal listener 1884 (or the TAS_MQTT_* overrides) or supply credentials via options'
    );
  }
});
