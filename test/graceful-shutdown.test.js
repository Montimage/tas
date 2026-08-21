const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const net = require('node:net');
const { spawn } = require('node:child_process');

const FIXTURE = `${__dirname}/fixtures/shutdown-fixture-server.js`;
const APP = `${__dirname}/../src/server/app.js`;

/**
 * Start the shutdown fixture and resolve once it reports its port.
 * @param {Object} env Extra environment values for the fixture process
 * @returns {Promise<{child: Object, port: Number, stderr: String}>}
 */
function startFixture(env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [FIXTURE], {
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    let settled = false;
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
      const ready = /READY (\d+)/.exec(stdout);
      if (ready && !settled) {
        settled = true;
        resolve({ child, port: Number(ready[1]), getStderr: () => stderr });
      }
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('exit', (code, signal) => {
      if (!settled) {
        settled = true;
        reject(
          new Error(`fixture exited before READY (code=${code}, signal=${signal}): ${stderr}`)
        );
      }
    });
  });
}

/**
 * GET a fixture path and report when headers arrive and when the body ends.
 * @param {Number} port Fixture port
 * @param {String} requestPath Path to request
 * @returns {Promise<{onHeaders: Function, done: Promise<Object>}>}
 */
function slowRequest(port, requestPath) {
  let resolveHeaders;
  const onHeaders = new Promise((resolve) => {
    resolveHeaders = resolve;
  });
  const done = new Promise((resolve, reject) => {
    const req = http.get({ host: '127.0.0.1', port, path: requestPath }, (res) => {
      // Headers have arrived while the body is still streaming — this is the
      // moment a signal can land while the request is in flight.
      resolveHeaders({ statusCode: res.statusCode });
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        resolve({ statusCode: res.statusCode, body });
      });
    });
    req.on('error', reject);
  });
  return { onHeaders, done };
}

/**
 * Wait for a child process to exit.
 * @param {Object} child The spawned fixture process
 * @param {Number} timeoutMs How long to wait before failing
 * @returns {Promise<{code: Number, signal: String}>}
 */
function waitForExit(child, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`process did not exit within ${timeoutMs}ms`));
    }, timeoutMs);
    child.once('exit', (code, signal) => {
      clearTimeout(timer);
      resolve({ code, signal });
    });
  });
}

test('SIGTERM lets an in-flight request finish before exiting 0', async () => {
  const { child, port, getStderr } = await startFixture({
    FIXTURE_FIRST_DELAY_MS: '300',
    FIXTURE_SECOND_DELAY_MS: '600',
    FIXTURE_GRACE_MS: '5000',
  });

  // Hold a request in flight: headers arrive after 300ms, the body only ends
  // after another 600ms — the signal lands in that window.
  const request = slowRequest(port, '/slow');
  const headers = await request.onHeaders;
  assert.strictEqual(headers.statusCode, 200, 'the slow request should have started');

  const exited = waitForExit(child, 10000);
  child.kill('SIGTERM');

  const response = await request.done;
  const exit = await exited;

  assert.strictEqual(response.statusCode, 200, 'the drained response should still be 200');
  assert.strictEqual(
    response.body,
    'halffull',
    'the response must have completed across the SIGTERM'
  );
  assert.strictEqual(exit.code, 0, `SIGTERM should exit 0, got ${exit.code} (${exit.signal})`);
  assert.match(
    getStderr(),
    /\[FIXTURE\] database closed/,
    'the database step must run before exit'
  );
});

test('SIGINT exits 0 and closes the database', async () => {
  const { child, port, getStderr } = await startFixture({ FIXTURE_GRACE_MS: '5000' });

  const health = slowRequest(port, '/health');
  await health.done;

  const exited = waitForExit(child, 10000);
  child.kill('SIGINT');
  const exit = await exited;

  assert.strictEqual(exit.code, 0, `SIGINT should exit 0, got ${exit.code} (${exit.signal})`);
  assert.match(
    getStderr(),
    /\[FIXTURE\] database closed/,
    'the database step must run before exit'
  );
});

test('a connection still open past the grace period forces exit 1', async () => {
  const { child, port } = await startFixture({
    FIXTURE_HANG: '1',
    FIXTURE_GRACE_MS: '400',
  });

  // The socket stays active forever; only the grace period can end this.
  const hung = slowRequest(port, '/slow');
  await hung.onHeaders;
  // The forced exit destroys this client socket mid-response, which surfaces
  // here as a request error — expected, so it must not fail the test.
  hung.done.catch(() => {});

  const exited = waitForExit(child, 10000);
  child.kill('SIGTERM');
  const exit = await exited;

  assert.strictEqual(exit.code, 1, `an overrun drain should exit 1, got ${exit.code}`);
});

test('the real server exits 0 on SIGTERM with no database configured', async () => {
  const port = await new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.listen(0, '127.0.0.1', () => {
      const freePort = probe.address().port;
      probe.close(() => resolve(freePort));
    });
    probe.on('error', reject);
  });

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tas-shutdown-'));
  fs.writeFileSync(path.join(tmp, '.env'), `SERVER_HOST=127.0.0.1\nSERVER_PORT=${port}\n`);

  const child = spawn(process.execPath, [APP], {
    cwd: tmp,
    env: {
      ...process.env,
      NODE_ENV: 'production',
      AUTH_ADMIN_USERNAME: 'shutdown-admin',
      AUTH_ADMIN_PASSWORD: 'shutdown-password',
      SESSION_SECRET: 'shutdown-session-secret',
    },
    stdio: 'ignore',
  });

  try {
    await new Promise((resolve, reject) => {
      const started = Date.now();
      const attempt = () => {
        const req = http.get(`http://127.0.0.1:${port}/api/health`, (res) => {
          res.resume();
          resolve(res.statusCode);
        });
        req.on('error', () => {
          if (Date.now() - started > 15000) {
            return reject(new Error('server did not come up within 15000ms'));
          }
          setTimeout(attempt, 300);
        });
      };
      attempt();
    });

    const exited = waitForExit(child, 15000);
    child.kill('SIGTERM');
    const exit = await exited;

    assert.strictEqual(exit.code, 0, `SIGTERM should exit 0, got ${exit.code} (${exit.signal})`);
  } finally {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill('SIGKILL');
    }
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
