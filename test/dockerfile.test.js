const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');

const REPO = `${__dirname}/..`;
const dockerfile = fs.readFileSync(`${REPO}/Dockerfile`, 'utf8');
const supervisor = fs.readFileSync(`${REPO}/supervisord.conf`, 'utf8');
const dockerignore = fs.readFileSync(`${REPO}/.dockerignore`, 'utf8');
const brokerConfPath = fs.existsSync(`${REPO}/mosquitto.conf`) ? `${REPO}/mosquitto.conf` : null;
const brokerConf = brokerConfPath ? fs.readFileSync(brokerConfPath, 'utf8') : '';

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

test('supervisord config never forces a root user and supervises all three services', () => {
  assert.ok(!/user\s*=\s*root/.test(supervisor), 'supervisor programs must not run as root');
  for (const program of ['mosquitto', 'nodered', 'tas']) {
    assert.match(
      supervisor,
      new RegExp(`\\[program:${program}\\]`),
      `missing [program:${program}]`
    );
  }
});

test('dev-only artifacts and .env are excluded from the image build context', () => {
  const lines = dockerignore.split('\n').map((l) => l.trim());
  assert.ok(lines.includes('node_modules/'), '.dockerignore must exclude node_modules');
  assert.ok(lines.includes('.env'), '.dockerignore must exclude .env');
});

// --- Issue #76: the supervised application runs in production mode ---

test('the supervised app process is given NODE_ENV=production (issue #76)', () => {
  const tas = supervisor.split('[program:tas]')[1];
  assert.ok(tas, 'supervisord.conf must define [program:tas]');
  assert.match(
    tas,
    /environment\s*=\s*NODE_ENV="production"/,
    '[program:tas] must set environment=NODE_ENV="production" (npm start sets it; the direct node invocation does not)'
  );
});

// --- Issue #46: the broker is configured explicitly, not by distro defaults ---

test('the image ships the committed broker config over the distro default', () => {
  assert.ok(brokerConfPath, 'mosquitto.conf must be committed to the repository');
  assert.match(
    dockerfile,
    /COPY\s+mosquitto\.conf\s+\/etc\/mosquitto\/mosquitto\.conf/,
    'Dockerfile must COPY mosquitto.conf over /etc/mosquitto/mosquitto.conf'
  );
  const mosquitto = supervisor.split('[program:mosquitto]')[1];
  assert.ok(mosquitto, 'supervisord.conf must define [program:mosquitto]');
  assert.match(
    mosquitto,
    /-c\s+\/etc\/mosquitto\/mosquitto\.conf/,
    'supervisord must start mosquitto against the shipped config path'
  );
});

test('the broker policy authenticates its exposed listener', () => {
  assert.ok(brokerConfPath, 'mosquitto.conf must be committed to the repository');
  assert.match(brokerConf, /^listener\s+1883\b/m, 'must declare the exposed listener on 1883');
  // mosquitto >= 2.1 scopes anonymous access per listener with the
  // listener_-prefixed form; the bare form is the pre-2.1 spelling.
  assert.match(
    brokerConf,
    /^(listener_)?allow_anonymous\s+false\b/m,
    'the exposed listener must refuse anonymous access'
  );
  assert.match(
    brokerConf,
    /^password_file\s+\S+/m,
    'the exposed listener must check credentials against a password file'
  );
  assert.ok(
    !/^per_listener_settings\b/m.test(brokerConf),
    'the deprecated per_listener_settings option must not be used'
  );
});

test('broker credentials are supplied at runtime, never committed', () => {
  // The password file path lives outside the build context so an operator
  // mounts it at runtime; nothing credential-like may ship in the repo or
  // the image build context.
  assert.match(
    brokerConf,
    /^password_file\s+\/run\/mosquitto\/passwd$/m,
    'the password file must be read from a runtime mount point'
  );
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

test('broker persistence is explicit and the internal listener stays loopback-only', () => {
  assert.match(brokerConf, /^persistence\s+true\b/m, 'persistence must be stated explicitly');
  assert.match(
    brokerConf,
    /^persistence_location\s+\S+/m,
    'persistence location must be stated explicitly'
  );
  const internal = brokerConf.split(/^listener\s+1884.*$/m)[1];
  assert.ok(internal, 'an internal loopback-only listener must exist for co-located processes');
  const nextListener = internal.search(/^listener\s/m);
  const internalBlock = nextListener === -1 ? internal : internal.slice(0, nextListener);
  assert.match(
    internalBlock,
    /^(listener_)?allow_anonymous\s+true\b/m,
    'the internal listener allows anonymous in-container clients'
  );
  assert.match(
    brokerConf,
    /^listener\s+1884\s+127\.0\.0\.1\b/m,
    'the internal listener must be bound to loopback only'
  );
});

test('in-container consumers never dial the authenticated listener anonymously', () => {
  // Everything that ships inside the image and talks to its own broker can
  // only use the loopback anonymous listener (1884): the published 1883
  // refuses anonymous access by policy, so a co-located consumer still
  // pointing there silently stops publishing (issue #46).
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
        'use the loopback listener 1884 or supply credentials via options'
    );
  }
});
