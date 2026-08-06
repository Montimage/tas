/**
 * Authentication failure logging (issue #9, AC7).
 *
 * A rejected login that leaves no trace is a brute-force run nobody can see.
 * These tests pin the shape of the record: one line per attempt, carrying the
 * attempted username, the client address, the user agent, the reason and a
 * running count of consecutive failures from that address - and never the
 * password, the session identifier or the CSRF token.
 */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { startApp, TEST_CREDENTIALS } = require("./helpers/start-app");
const {
  createFailureTracker,
  sanitizeForLog,
} = require("../src/server/routes/auth");

const USERNAME = TEST_CREDENTIALS.AUTH_ADMIN_USERNAME;
const PASSWORD = TEST_CREDENTIALS.AUTH_ADMIN_PASSWORD;

/**
 * Log in (or try to) and return the response.
 * @param {Object} ctx Started application context
 * @param {Object} credentials {username, password}
 * @param {Object} [headers] Extra request headers
 * @returns {Promise<{status:Number,raw:String}>}
 */
async function attempt(ctx, credentials, headers = {}) {
  const res = await fetch(ctx.base + "/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(credentials),
  });
  return { status: res.status, raw: await res.text() };
}

/**
 * Run a block with `console.error` captured.
 * @param {Object} env Environment overrides
 * @param {Function} fn Receives (ctx, lines)
 * @returns {Promise<String[]>} Everything written while the block ran
 */
async function withCapturedLog(env, fn) {
  const ctx = await startApp(env, { login: false });
  const original = console.error;
  const lines = [];
  console.error = (line) => lines.push(String(line));
  try {
    await fn(ctx, lines);
  } finally {
    console.error = original;
    await new Promise((resolve) => ctx.server.close(resolve));
    ctx.restore();
  }
  return lines;
}

test("every failed login is recorded with an incrementing failure count", async () => {
  const password = "guess-number-";
  const lines = await withCapturedLog({}, async (ctx) => {
    for (let i = 1; i <= 5; i += 1) {
      const res = await attempt(
        ctx,
        { username: USERNAME, password: password + i },
        { "User-Agent": "brute-force-tool/1.0" }
      );
      assert.equal(res.status, 401, `attempt ${i} must be refused`);
    }
  });

  const failures = lines.filter((line) => line.startsWith("[AUTH] login failed"));
  assert.equal(failures.length, 5, `expected 5 failure lines, got: ${lines.join(" | ")}`);

  failures.forEach((line, index) => {
    assert.match(line, new RegExp(`user="${USERNAME}"`), line);
    assert.match(line, /ip=127\.0\.0\.1/, line);
    assert.match(line, /ua="brute-force-tool\/1\.0"/, line);
    assert.match(line, /reason=invalid_credentials/, line);
    assert.match(line, new RegExp(`failures=${index + 1}(\\s|$)`), `line ${index + 1}: ${line}`);
  });

  // Nothing in the log may carry what was guessed.
  for (const line of lines) {
    assert.ok(!line.includes(password), `a password reached the log: ${line}`);
    assert.ok(!line.includes(PASSWORD), `the real password reached the log: ${line}`);
  }
});

test("a successful login is recorded and resets the failure counter", async () => {
  const lines = await withCapturedLog({}, async (ctx) => {
    await attempt(ctx, { username: USERNAME, password: "wrong-1" });
    await attempt(ctx, { username: USERNAME, password: "wrong-2" });
    const ok = await attempt(ctx, { username: USERNAME, password: PASSWORD });
    assert.equal(ok.status, 200, ok.raw);
    const again = await attempt(ctx, { username: USERNAME, password: "wrong-3" });
    assert.equal(again.status, 401);
  });

  const failures = lines.filter((line) => line.startsWith("[AUTH] login failed"));
  const successes = lines.filter((line) => line.startsWith("[AUTH] login succeeded"));

  assert.equal(successes.length, 1, `expected one success line: ${lines.join(" | ")}`);
  assert.match(successes[0], new RegExp(`user="${USERNAME}"`));
  assert.match(successes[0], /ip=127\.0\.0\.1/);
  assert.match(successes[0], /ua="/);

  assert.equal(failures.length, 3);
  assert.match(failures[0], /failures=1(\s|$)/);
  assert.match(failures[1], /failures=2(\s|$)/);
  // The success in between reset the counter, so this run starts over at 1.
  assert.match(failures[2], /failures=1(\s|$)/, failures[2]);

  for (const line of lines) {
    assert.ok(!line.includes(PASSWORD), `the password reached the log: ${line}`);
    assert.ok(!line.includes("csrfToken"), `a token reached the log: ${line}`);
  }
});

test("a login refused because nothing is configured says so", async () => {
  const lines = await withCapturedLog(
    { AUTH_ADMIN_PASSWORD: "", AUTH_ADMIN_PASSWORD_HASH: "" },
    async (ctx) => {
      const res = await attempt(ctx, { username: "admin", password: "anything" });
      assert.equal(res.status, 503, res.raw);
    }
  );
  const failure = lines.find((line) => line.startsWith("[AUTH] login failed"));
  assert.ok(failure, `expected a failure line: ${lines.join(" | ")}`);
  assert.match(failure, /reason=not_configured/);
  assert.match(failure, /failures=1(\s|$)/);
});

test("no session identifier or CSRF token is ever written to the log", async () => {
  let secrets = [];
  const lines = await withCapturedLog({}, async (ctx) => {
    const res = await fetch(ctx.base + "/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: USERNAME, password: PASSWORD }),
    });
    const body = JSON.parse(await res.text());
    const cookies = res.headers.getSetCookie();
    secrets = [body.csrfToken].concat(cookies.map((c) => c.split(";")[0].split("=")[1]));
  });
  for (const line of lines) {
    for (const secret of secrets) {
      if (!secret) continue;
      assert.ok(!line.includes(secret), `a session secret reached the log: ${line}`);
    }
  }
});

test("a username carrying newlines cannot forge extra log lines", async () => {
  const hostile = 'victim"\n[AUTH] login succeeded user="attacker" ip=1.2.3.4';
  const lines = await withCapturedLog({}, async (ctx) => {
    const res = await attempt(ctx, { username: hostile, password: "wrong" });
    assert.equal(res.status, 401, res.raw);
  });
  for (const line of lines) {
    assert.ok(!line.includes("\n"), `a log line must stay one line: ${JSON.stringify(line)}`);
  }
  assert.equal(
    lines.filter((line) => line.startsWith("[AUTH] login succeeded")).length,
    0,
    "an injected success line must not appear"
  );
});

// ---------------------------------------------------------------------------
// The pieces the log line is built from
// ---------------------------------------------------------------------------

test("sanitizeForLog strips what could forge or break a log line", () => {
  assert.equal(sanitizeForLog("plain-user"), "plain-user");
  assert.equal(sanitizeForLog("a\r\nb"), "a b");
  assert.equal(sanitizeForLog("a\u0000\u001fb\u007f"), "ab", "control characters are removed");
  assert.equal(sanitizeForLog('say "hi"'), "say 'hi'");
  assert.equal(sanitizeForLog(undefined), "");
  assert.equal(sanitizeForLog(null), "");
  assert.equal(sanitizeForLog("x".repeat(500)).length, 200);
});

test("the failure tracker counts per address, resets on success and stays bounded", () => {
  const tracker = createFailureTracker();
  assert.equal(tracker.get("1.1.1.1"), 0);
  assert.equal(tracker.fail("1.1.1.1"), 1);
  assert.equal(tracker.fail("1.1.1.1"), 2);
  assert.equal(tracker.fail("2.2.2.2"), 1, "each address counts on its own");
  tracker.reset("1.1.1.1");
  assert.equal(tracker.get("1.1.1.1"), 0);
  assert.equal(tracker.fail("1.1.1.1"), 1);

  // An unbounded map keyed by the caller's own address would be a memory sink.
  for (let i = 0; i < 1500; i += 1) {
    tracker.fail(`10.0.${Math.floor(i / 256)}.${i % 256}`);
  }
  assert.equal(tracker.get("10.0.0.0"), 0, "the oldest entries must be evicted");
  assert.equal(tracker.get("10.0.5.219"), 1, "the newest entries must be kept");
});
