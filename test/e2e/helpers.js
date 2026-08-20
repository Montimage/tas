/**
 * Shared helpers for the end-to-end security regression suite.
 *
 * Every test in this directory drives a REAL, separately spawned instance of
 * the application over HTTP - it never mounts the Express app or calls route
 * handlers in-process. This mirrors a deployed deployment and proves that the
 * containment fixes hold against a running server.
 */
const http = require('node:http');
const net = require('node:net');
const path = require('node:path');
const fs = require('node:fs');
const { spawn } = require('node:child_process');

const repoRoot = path.resolve(__dirname, '../..');
const modelsDir = path.resolve(repoRoot, 'src/server/data/models');
const recordersDir = path.resolve(repoRoot, 'src/server/data/data-recorders');
const repoPackageJson = path.resolve(repoRoot, 'package.json');
const devopsConfigPath = path.resolve(repoRoot, 'src/server/data/devops.json');
const campaignLogsDir = path.resolve(repoRoot, 'src/server/logs/test-campaigns');

/** An origin the server will be configured to allow via CORS_ALLOWED_ORIGINS. */
const allowedOrigin = 'http://allowed.example';

/** An origin that is never listed, used to prove unlisted origins are rejected. */
const hostileOrigin = 'http://evil.example';

/**
 * Credentials every spawned instance in this directory boots with.
 *
 * The API is closed by default (issue #9), so a suite that drives a real
 * instance needs an account. Passed through the child's environment and used by
 * `startServer` to log in once, so the existing assertions keep driving the API
 * the way they always have.
 */
const testCredentials = {
  AUTH_ADMIN_USERNAME: 'e2e-admin',
  AUTH_ADMIN_PASSWORD: 'e2e-password',
  SESSION_SECRET: 'e2e-session-secret',
};

/**
 * Session headers per running instance, keyed by base URL.
 *
 * `request` attaches them by default so every call site written before the API
 * was closed keeps working unchanged; pass `{ anonymous: true }` to send a
 * request with no credentials.
 */
const sessions = new Map();

/**
 * Make an HTTP request against a running instance.
 * @param {String} baseUrl e.g. http://127.0.0.1:3004
 * @param {String} method  HTTP method
 * @param {String} requestPath Request path (may contain URL-encoded sequences)
 * @param {Object} [options]
 * @param {Object} [options.body] JSON body to send
 * @param {Object} [options.headers] Extra request headers (e.g. Origin)
 * @param {Boolean} [options.anonymous] Send no session credentials
 * @returns {Promise<{status:Number,headers:Object,raw:String,body:Object|null}>}
 */
function request(baseUrl, method, requestPath, { body, headers = {}, anonymous = false } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(baseUrl);
    const data = body ? JSON.stringify(body) : null;
    const auth = anonymous ? {} : sessions.get(baseUrl) || {};
    const req = http.request(
      {
        hostname: u.hostname,
        port: u.port,
        path: requestPath,
        method,
        headers: {
          ...(data ? { 'Content-Type': 'application/json' } : {}),
          ...auth,
          ...headers,
        },
      },
      (res) => {
        let raw = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          raw += chunk;
        });
        res.on('end', () => {
          let parsed = null;
          try {
            parsed = JSON.parse(raw);
          } catch (_) {
            /* not JSON */
          }
          resolve({
            status: res.statusCode,
            headers: res.headers,
            raw,
            body: parsed,
          });
        });
      }
    );
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

/**
 * Log in against a running instance and return the headers every later request
 * needs: the session cookie and the CSRF token bound to it.
 * @param {String} baseUrl Instance base URL
 * @param {Object} credentials {username, password}
 * @returns {Promise<{cookie:String,csrfToken:String,authHeaders:Object}>}
 */
async function logIn(baseUrl, credentials) {
  const res = await request(baseUrl, 'POST', '/api/auth/login', {
    anonymous: true,
    body: { username: credentials.username, password: credentials.password },
  });
  if (res.status !== 200 || !res.body || !res.body.csrfToken) {
    throw new Error(`e2e login failed (${res.status}): ${res.raw}`);
  }
  const cookie = (res.headers['set-cookie'] || []).map((value) => value.split(';')[0]).join('; ');
  return {
    cookie,
    csrfToken: res.body.csrfToken,
    authHeaders: { Cookie: cookie, 'X-CSRF-Token': res.body.csrfToken },
  };
}

/** Return a currently-free localhost port (small race window, fine for E2E). */
function getFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

/**
 * Start a real server instance as a child process and wait until it answers.
 * The actually-bound port is discovered from the server's own startup log so
 * the suite does not depend on which configuration source (env or .env) the
 * server honours.
 * @param {Object} [env] Environment overrides for the child (exposed as config)
 * @returns {Promise<{baseUrl:String,port:Number,child:ChildProcess,stop:Function}>}
 */
async function startServer(env = {}) {
  const seedPort = await getFreePort();
  const child = spawn(process.execPath, ['src/server/app.js'], {
    cwd: repoRoot,
    env: {
      ...process.env,
      SERVER_HOST: '127.0.0.1',
      SERVER_PORT: String(seedPort),
      ...testCredentials,
      ...env,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (d) => {
    stdout += d;
  });
  child.stderr.on('data', (d) => {
    stderr += d;
  });

  const deadline = Date.now() + 30000;
  let port = null;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      child.kill('SIGKILL');
      throw new Error(`server exited early (code ${child.exitCode}): ${stderr.trim()}`);
    }
    const match = stdout.match(/http:\/\/[^:/\s]+:(\d+)/);
    if (match) {
      port = Number(match[1]);
      const baseUrl = `http://127.0.0.1:${port}`;
      try {
        const res = await request(baseUrl, 'GET', '/');
        if (res.status >= 200 && res.status < 500) {
          const session = await logIn(baseUrl, {
            username: env.AUTH_ADMIN_USERNAME || testCredentials.AUTH_ADMIN_USERNAME,
            password: env.AUTH_ADMIN_PASSWORD || testCredentials.AUTH_ADMIN_PASSWORD,
          });
          sessions.set(baseUrl, session.authHeaders);
          return {
            baseUrl,
            port,
            child,
            cookie: session.cookie,
            csrfToken: session.csrfToken,
            authHeaders: session.authHeaders,
            stop: () =>
              new Promise((resolveStop) => {
                if (child.exitCode !== null) return resolveStop();
                child.once('exit', resolveStop);
                child.kill('SIGTERM');
                setTimeout(() => {
                  if (child.exitCode === null) child.kill('SIGKILL');
                }, 3000).unref();
              }),
          };
        }
      } catch (_) {
        /* not listening yet */
      }
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  child.kill('SIGKILL');
  throw new Error(`server did not become ready (last bound port ${port}): ${stderr.trim()}`);
}

/** A unique, filesystem-safe identifier for created test artifacts. */
const unique = (prefix) => `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

const inModelsDir = (fileName) => path.join(modelsDir, fileName);
const inRecordersDir = (fileName) => path.join(recordersDir, fileName);

/**
 * Every location a traversal payload in this suite would land a file if
 * containment regressed. The storage root is `src/server/data/models`, so
 * `../` escapes to `src/server/data` and `../../` to `src/server` - NOT to the
 * repo root. Canaries must check the real targets, otherwise a successful
 * escape passes unnoticed.
 * @param {String} baseName Artifact name without the `.json` extension
 * @returns {String[]} Absolute paths that must never exist after a hostile name
 */
const escapeArtifacts = (baseName) => [
  path.join(modelsDir, `${baseName}.json`),
  path.resolve(modelsDir, `../${baseName}.json`),
  path.resolve(modelsDir, `../../${baseName}.json`),
  path.resolve(repoRoot, `${baseName}.json`),
];

/**
 * Delete a file if it exists. The suite is the regression gate and is expected
 * to be red until the containment fixes land, so it must clean up anything an
 * unfixed instance escaped into the source tree rather than leaving it behind.
 * @param {String} filePath Absolute path to remove
 */
const removeIfPresent = (filePath) => {
  try {
    fs.unlinkSync(filePath);
  } catch (_) {
    /* absent, which is the expected case */
  }
};

/**
 * Every directory a `../` payload in a test-campaign log filename reaches from
 * `src/server/logs/test-campaigns/`. The logger creates missing parents, so an
 * escaping name really does write into these if containment regresses - the
 * canaries must look where the payload actually lands.
 */
const campaignLogEscapeDirs = [
  path.resolve(campaignLogsDir, '..'),
  path.resolve(campaignLogsDir, '../..'),
  path.resolve(campaignLogsDir, '../../..'),
  repoRoot,
];

/**
 * Absolute paths of any file in a campaign-log escape directory whose name
 * starts with the given prefix. The log filename carries a timestamp, so the
 * canary matches on the prefix rather than an exact name.
 * @param {String} prefix Artifact name prefix, e.g. the hostile campaign id
 * @returns {String[]} Paths that must be empty after a rejected request
 */
const escapedCampaignLogs = (prefix) =>
  campaignLogEscapeDirs.flatMap((dir) => {
    try {
      return fs
        .readdirSync(dir)
        .filter((f) => f.startsWith(prefix))
        .map((f) => path.join(dir, f));
    } catch (_) {
      return []; // directory absent, which is the expected case
    }
  });

/** Snapshot the list of files in a directory (for "nothing written/removed" asserts). */
const listDir = (dir) =>
  new Promise((resolve) => fs.readdir(dir, (err, files) => resolve(err ? null : files.sort())));

module.exports = {
  repoRoot,
  modelsDir,
  recordersDir,
  repoPackageJson,
  devopsConfigPath,
  campaignLogsDir,
  allowedOrigin,
  hostileOrigin,
  request,
  startServer,
  logIn,
  testCredentials,
  unique,
  inModelsDir,
  inRecordersDir,
  escapeArtifacts,
  escapedCampaignLogs,
  removeIfPresent,
  listDir,
};
