const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const net = require('node:net');
const { spawn } = require('node:child_process');

const REPO = `${__dirname}/..`;

function getFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
    srv.on('error', reject);
  });
}

function waitForStatus(url, timeoutMs = 15000, headers = {}) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const req = http.get(url, { headers }, (res) => {
        res.resume();
        resolve(res.statusCode);
      });
      req.on('error', () => {
        if (Date.now() - started > timeoutMs) {
          return reject(new Error(`server did not respond within ${timeoutMs}ms at ${url}`));
        }
        setTimeout(attempt, 300);
      });
    };
    attempt();
  });
}

/**
 * Log in against a freshly started instance and return the session cookie.
 * @param {String} base Instance base URL
 * @param {Object} credentials {username, password}
 * @returns {Promise<String>} The `Cookie` header value
 */
function login(base, credentials) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(credentials);
    const req = http.request(
      `${base}/api/auth/login`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
      },
      (res) => {
        let raw = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => (raw += chunk));
        res.on('end', () => {
          if (res.statusCode !== 200) {
            return reject(new Error(`login failed (${res.statusCode}): ${raw}`));
          }
          resolve((res.headers['set-cookie'] || []).map((c) => c.split(';')[0]).join('; '));
        });
      }
    );
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

test('server starts and serves dashboard + API without a tracked .env file', async () => {
  const port = await getFreePort();
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tas-smoke-'));
  fs.writeFileSync(path.join(tmp, '.env'), `SERVER_HOST=127.0.0.1\nSERVER_PORT=${port}\n`);
  const appFile = path.join(REPO, 'src/server/app.js');
  const child = spawn(process.execPath, [appFile], {
    cwd: tmp,
    env: {
      ...process.env,
      NODE_ENV: 'production',
      // The API is closed by default (issue #9), so a smoke test needs an
      // account - provisioned the way an operator provisions one.
      AUTH_ADMIN_USERNAME: 'smoke-admin',
      AUTH_ADMIN_PASSWORD: 'smoke-password',
      SESSION_SECRET: 'smoke-session-secret',
    },
    stdio: 'ignore',
  });
  try {
    const base = `http://127.0.0.1:${port}`;
    // The liveness probe is on the documented public allowlist, so it is what
    // tells us the process is up before there is a session to use.
    const healthStatus = await waitForStatus(`${base}/api/health`);
    assert.strictEqual(healthStatus, 200, 'GET /api/health should return 200');

    const anonymous = await waitForStatus(`${base}/api/models`);
    assert.strictEqual(anonymous, 401, 'GET /api/models should be closed to anonymous callers');

    const cookie = await login(base, { username: 'smoke-admin', password: 'smoke-password' });
    const apiStatus = await waitForStatus(`${base}/api/models`, 15000, { Cookie: cookie });
    assert.strictEqual(apiStatus, 200, 'GET /api/models should return 200');

    const indexStatus = await waitForStatus(`${base}/`);
    assert.strictEqual(indexStatus, 200, 'GET / should return 200');
  } finally {
    child.kill('SIGKILL');
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
