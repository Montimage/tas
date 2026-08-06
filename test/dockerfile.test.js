const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');

const REPO = `${__dirname}/..`;
const dockerfile = fs.readFileSync(`${REPO}/Dockerfile`, 'utf8');
const supervisor = fs.readFileSync(`${REPO}/supervisord.conf`, 'utf8');
const dockerignore = fs.readFileSync(`${REPO}/.dockerignore`, 'utf8');

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
  assert.match(dockerfile, /chown\s+-R\s+node:node/, 'app and runtime dirs must be chowned to node');
});

test('supervisord config never forces a root user and supervises all three services', () => {
  assert.ok(!/user\s*=\s*root/.test(supervisor), 'supervisor programs must not run as root');
  for (const program of ['mosquitto', 'nodered', 'tas']) {
    assert.match(supervisor, new RegExp(`\\[program:${program}\\]`), `missing [program:${program}]`);
  }
});

test('dev-only artifacts and .env are excluded from the image build context', () => {
  const lines = dockerignore.split('\n').map((l) => l.trim());
  assert.ok(lines.includes('node_modules/'), '.dockerignore must exclude node_modules');
  assert.ok(lines.includes('.env'), '.dockerignore must exclude .env');
});