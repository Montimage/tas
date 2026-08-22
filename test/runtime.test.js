const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

// Runtime contract guard (issue #32).
//
// The supported Node LTS is stated in exactly one place — .nvmrc — and every
// other surface must agree with it: the engines declaration in both manifests
// (npm warns on any other runtime), the Dockerfile base image, and the CI
// workflows, which read their Node version straight from .nvmrc. This file
// keeps those surfaces from drifting apart when the LTS moves again.
const REPO = path.join(__dirname, '..');

const nvmrc = fs.readFileSync(`${REPO}/.nvmrc`, 'utf8').trim();
const rootManifest = JSON.parse(fs.readFileSync(`${REPO}/package.json`, 'utf8'));
const clientManifest = JSON.parse(fs.readFileSync(`${REPO}/src/client/package.json`, 'utf8'));
const dockerfile = fs.readFileSync(`${REPO}/Dockerfile`, 'utf8');
const workflows = [
  '.github/workflows/build-docker-container.yml',
  '.github/workflows/e2e-security.yml',
].map((rel) => [rel, fs.readFileSync(`${REPO}/${rel}`, 'utf8')]);

test('.nvmrc pins a concrete Node major', () => {
  assert.match(nvmrc, /^\d+$/, '.nvmrc must contain a bare Node major');
});

test('both manifests declare engines matching the pinned major', () => {
  for (const [label, manifest] of [
    ['package.json', rootManifest],
    ['src/client/package.json', clientManifest],
  ]) {
    const range = manifest.engines && manifest.engines.node;
    assert.ok(range, `${label} must declare engines.node`);
    const floor = Number(String(range).match(/>=\s*(\d+)/)?.[1]);
    assert.equal(
      floor,
      Number(nvmrc),
      `${label} engines floor must be the .nvmrc major (${nvmrc})`
    );
  }
});

test('the Dockerfile base image uses the pinned major', () => {
  const m = dockerfile.match(/^FROM\s+node:(\d+)-alpine/m);
  assert.ok(m, 'Dockerfile must use a node:<major>-alpine base image');
  assert.equal(Number(m[1]), Number(nvmrc), 'base image must match .nvmrc');
});

test('CI reads its Node version from .nvmrc instead of a hardcode', () => {
  for (const [file, body] of workflows) {
    assert.match(body, /node-version-file:\s*\.nvmrc\b/, `${file} must set up Node from .nvmrc`);
    assert.ok(!/^\s*node-version:\s*['"]?\d/m.test(body), `${file} must not hardcode node-version`);
  }
});
