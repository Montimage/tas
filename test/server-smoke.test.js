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

function waitForStatus(url, timeoutMs = 15000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const req = http.get(url, (res) => {
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

test('server starts and serves dashboard + API without a tracked .env file', async () => {
  const port = await getFreePort();
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tas-smoke-'));
  fs.writeFileSync(path.join(tmp, '.env'), `SERVER_HOST=127.0.0.1\nSERVER_PORT=${port}\n`);
  const appFile = path.join(REPO, 'src/server/app.js');
  const child = spawn(process.execPath, [appFile], {
    cwd: tmp,
    env: { ...process.env, NODE_ENV: 'production' },
    stdio: 'ignore'
  });
  try {
    const apiStatus = await waitForStatus(`http://127.0.0.1:${port}/api/models`);
    assert.strictEqual(apiStatus, 200, 'GET /api/models should return 200');
    const indexStatus = await waitForStatus(`http://127.0.0.1:${port}/`);
    assert.strictEqual(indexStatus, 200, 'GET / should return 200');
  } finally {
    child.kill('SIGKILL');
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});