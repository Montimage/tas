/**
 * End-to-end container assertion (issue #8): the built image runs its
 * application processes as a non-root user.
 *
 * Two layers:
 *   1. Static: the Dockerfile must drop to the unprivileged `node` user.
 *   2. Runtime (when TAS_IMAGE is provided): `docker inspect` the built image
 *      and assert the effective container user is `node` (not root).
 *
 * CI builds the image and passes TAS_IMAGE so the runtime assertion executes.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const dockerfile = path.resolve(__dirname, '../../Dockerfile');
const image = process.env.TAS_IMAGE;

test('Dockerfile runs the application as the unprivileged `node` user', () => {
  const content = fs.readFileSync(dockerfile, 'utf8');
  assert.match(content, /^\s*USER\s+node\s*$/m, 'Dockerfile must declare USER node');
});

test(
  'built image runs its process as a non-root user',
  { skip: !image && 'TAS_IMAGE not set; runtime inspect skipped' },
  () => {
    const user = execFileSync('docker', ['inspect', '--format', '{{.Config.User}}', image], {
      encoding: 'utf8',
    }).trim();
    assert.equal(user, 'node', `expected container user 'node', got '${user || '<root>'}'`);
  }
);
