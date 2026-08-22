/**
 * End-to-end container assertions (issues #8, #46, #76).
 *
 * Two layers:
 *   1. Static: the Dockerfile must drop to the unprivileged `node` user.
 *   2. Runtime (when TAS_IMAGE is provided): assert against the BUILT image —
 *      the effective container user is `node` (not root) (#8), the shipped
 *      broker config is the committed one, byte for byte (#46), and the
 *      supervised application process really runs with NODE_ENV=production
 *      (#76).
 *
 * CI builds the image and passes TAS_IMAGE so the runtime assertions execute.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const dockerfile = path.resolve(__dirname, '../../Dockerfile');
const brokerConf = path.resolve(__dirname, '../../mosquitto.conf');
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

test(
  'built image ships the committed MQTT broker configuration (issue #46)',
  { skip: !image && 'TAS_IMAGE not set; runtime inspect skipped' },
  () => {
    const committed = fs.readFileSync(brokerConf, 'utf8');
    const shipped = execFileSync(
      'docker',
      // The path supervisord starts mosquitto against.
      ['run', '--rm', image, 'cat', '/etc/mosquitto/mosquitto.conf'],
      { encoding: 'utf8' }
    );
    assert.equal(
      shipped,
      committed,
      '/etc/mosquitto/mosquitto.conf in the image must be the committed mosquitto.conf, not a distribution default'
    );
  }
);

test(
  'the supervised application process reports NODE_ENV=production (issue #76)',
  { skip: !image && 'TAS_IMAGE not set; runtime inspect skipped' },
  () => {
    // Start the image with its real entrypoint (supervisord), then read the
    // environment of the process whose cmdline is exactly the app entrypoint
    // — the same evidence an operator would gather inside a running
    // container. The match is anchored so no other process (whose argv could
    // carry this script's text) can self-match. A non-zero probe exit (app
    // missing or env wrong) throws and fails here.
    const name = `tas-e2e-nodeenv-${Date.now()}`;
    const probe =
      'i=0; while [ "$i" -lt 20 ]; do ' +
      'for p in /proc/[0-9]*/cmdline; do ' +
      'case "$(tr \'\\0\' \' \' < "$p" 2>/dev/null)" in ' +
      '"node /usr/src/app/src/server/app.js "*) ' +
      'pid=${p%/cmdline}; pid=${pid#/proc/}; ' +
      "if tr '\\0' '\\n' < \"/proc/$pid/environ\" 2>/dev/null | grep -qx 'NODE_ENV=production'; then exit 0; fi; " +
      'echo "app pid $pid is not running with NODE_ENV=production" >&2; ' +
      "tr '\\0' '\\n' < \"/proc/$pid/environ\" | grep '^NODE_ENV=' >&2; exit 1;; " +
      'esac; done; i=$((i + 1)); sleep 1; done; ' +
      'echo "no app.js process found under supervisord" >&2; exit 1';
    execFileSync('docker', ['run', '-d', '--name', name, image], { encoding: 'utf8' });
    try {
      execFileSync('docker', ['exec', name, 'sh', '-c', probe], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'inherit'],
        timeout: 60000,
      });
    } finally {
      try {
        execFileSync('docker', ['rm', '-f', name]);
      } catch (_) {
        /* already gone */
      }
    }
  }
);
