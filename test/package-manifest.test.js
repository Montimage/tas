const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const pkg = require('../package.json');
const lock = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package-lock.json'), 'utf8'));

const NODE_BUILTINS = new Set([
  'assert',
  'async_hooks',
  'buffer',
  'child_process',
  'cluster',
  'console',
  'constants',
  'crypto',
  'dgram',
  'diagnostics_channel',
  'dns',
  'domain',
  'events',
  'fs',
  'http',
  'http2',
  'https',
  'module',
  'net',
  'os',
  'path',
  'perf_hooks',
  'process',
  'punycode',
  'querystring',
  'readline',
  'repl',
  'stream',
  'string_decoder',
  'sys',
  'timers',
  'tls',
  'trace_events',
  'tty',
  'url',
  'util',
  'v8',
  'vm',
  'wasi',
  'worker_threads',
  'zlib',
]);

const ALL = { ...pkg.dependencies, ...pkg.devDependencies };

test('no manifest dependency shadows a Node built-in module', () => {
  for (const name of Object.keys(ALL)) {
    assert.ok(!NODE_BUILTINS.has(name), `package "${name}" shadows a Node built-in module`);
  }
});

test('the previously-shadowing packages are removed from the manifest', () => {
  for (const name of ['fs', 'path', 'crypto', 'zlib', 'child_process']) {
    assert.ok(!(name in ALL), `package "${name}" must not be a dependency`);
  }
});

test('build-only tooling lives under devDependencies, not runtime dependencies', () => {
  for (const name of ['nodemon', 'file-loader']) {
    assert.ok(name in pkg.devDependencies, `${name} should be a devDependency`);
    assert.ok(!(name in pkg.dependencies), `${name} must not be a runtime dependency`);
  }
});

test('the lockfile is a v2/v3 lockfile consistent with the manifest', () => {
  assert.ok(lock.packages, 'package-lock.json should be a v2/v3 lockfile');
  for (const name of Object.keys(pkg.dependencies)) {
    assert.ok(lock.packages[`node_modules/${name}`], `lockfile missing runtime dep ${name}`);
  }
  for (const name of Object.keys(pkg.devDependencies)) {
    const entry = lock.packages[`node_modules/${name}`];
    assert.ok(entry, `lockfile missing dev dep ${name}`);
    assert.strictEqual(entry.dev, true, `${name} should be marked dev in the lockfile`);
  }
});

test('a test script is defined for QA', () => {
  assert.ok(pkg.scripts && pkg.scripts.test, 'package.json should define a test script');
});
