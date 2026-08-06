/**
 * API authentication and session protection (issue #9).
 *
 * The API used to answer any caller that could reach the port. These tests pin
 * what replaced that: every endpoint but a short, explicit allowlist requires a
 * session, the administrator credential comes from configuration rather than
 * from the repository, and a session expires, slides while it is in use, and
 * can be thrown away.
 */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { startApp, TEST_CREDENTIALS } = require("./helpers/start-app");

/** Every API prefix the application mounts a router on. */
const API_PREFIXES = [
  "/api/models",
  "/api/data-recorders",
  "/api/data-storage",
  "/api/logs/data-recorders",
  "/api/logs/simulations",
  "/api/logs/test-campaigns",
  "/api/data-sets",
  "/api/test-cases",
  "/api/test-campaigns",
  "/api/events",
  "/api/reports",
  "/api/simulation",
  "/api/devops",
];

const USERNAME = TEST_CREDENTIALS.AUTH_ADMIN_USERNAME;
const PASSWORD = TEST_CREDENTIALS.AUTH_ADMIN_PASSWORD;

/**
 * Issue a request against a started context.
 * @param {Object} ctx Started application context
 * @param {String} method HTTP method
 * @param {String} path Request path
 * @param {Object} [options] {body, headers}
 * @returns {Promise<{status:Number,body:Object|null,raw:String,res:Response}>}
 */
async function call(ctx, method, path, options = {}) {
  const res = await fetch(ctx.base + path, {
    method,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const raw = await res.text();
  let body = null;
  try {
    body = JSON.parse(raw);
  } catch (_) {
    /* not JSON */
  }
  return { status: res.status, body, raw, res };
}

/**
 * Log in and return the headers an authenticated client sends.
 * @param {Object} ctx Started application context
 * @param {Object} [credentials] {username, password}
 * @returns {Promise<{headers:Object,csrfToken:String,cookie:String,setCookie:String[]}>}
 */
async function login(ctx, credentials = { username: USERNAME, password: PASSWORD }) {
  const res = await call(ctx, "POST", "/api/auth/login", { body: credentials });
  assert.equal(res.status, 200, `login should succeed: ${res.raw}`);
  const setCookie = res.res.headers.getSetCookie();
  const cookie = setCookie.map((value) => value.split(";")[0]).join("; ");
  return {
    setCookie,
    cookie,
    csrfToken: res.body.csrfToken,
    headers: { Cookie: cookie, "X-CSRF-Token": res.body.csrfToken },
  };
}

/**
 * Run a block against a freshly started instance.
 * @param {Object} env Environment overrides
 * @param {Object} opts startApp options
 * @param {Function} fn Receives the started context
 * @returns {Promise<void>}
 */
async function withApp(env, opts, fn) {
  const ctx = await startApp(env, opts);
  try {
    await fn(ctx);
  } finally {
    await new Promise((resolve) => ctx.server.close(resolve));
    ctx.restore();
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ---------------------------------------------------------------------------
// 1. The API is closed, and the allowlist is exactly what it says it is
// ---------------------------------------------------------------------------

test("every mounted API router rejects an anonymous GET with 401", async () => {
  await withApp({}, { login: false }, async (ctx) => {
    for (const prefix of API_PREFIXES) {
      const res = await call(ctx, "GET", prefix);
      assert.equal(res.status, 401, `${prefix} must be closed, got ${res.status}`);
      assert.equal(
        typeof res.body.error,
        "string",
        `${prefix} must answer with the central error shape: ${res.raw}`
      );
      assert.equal(res.body.error, "Authentication required");
    }
  });
});

test("anonymous state-changing requests and unknown API paths are rejected with 401", async () => {
  await withApp({}, { login: false }, async (ctx) => {
    const post = await call(ctx, "POST", "/api/models", {
      body: { model: { name: "anon", devices: [] } },
    });
    assert.equal(post.status, 401, `anonymous POST must be refused: ${post.raw}`);

    const del = await call(ctx, "DELETE", "/api/models/anything.json");
    assert.equal(del.status, 401, `anonymous DELETE must be refused: ${del.raw}`);

    // An unknown path must not disclose that it is unknown before the caller
    // has proved who it is.
    const unknown = await call(ctx, "GET", "/api/not-a-real-endpoint");
    assert.equal(unknown.status, 401);
    assert.equal(unknown.body.error, "Authentication required");
  });
});

test("the documented allowlist answers anonymously and nothing else does", async () => {
  await withApp({}, { login: false }, async (ctx) => {
    const health = await call(ctx, "GET", "/api/health");
    assert.equal(health.status, 200);
    assert.deepEqual(health.body, { status: "ok" });

    const session = await call(ctx, "GET", "/api/auth/session");
    assert.equal(session.status, 200);
    assert.deepEqual(session.body, { authenticated: false });

    // Reachable, and refused on its merits rather than by the gate.
    const login401 = await call(ctx, "POST", "/api/auth/login", {
      body: { username: "nobody", password: "nothing" },
    });
    assert.equal(login401.status, 401);
    assert.equal(login401.body.error, "Invalid credentials");

    // Logging out is an act on a session, so it is deliberately NOT allowlisted.
    const logout = await call(ctx, "POST", "/api/auth/logout");
    assert.equal(logout.status, 401, `anonymous logout must be refused: ${logout.raw}`);

    // The dashboard bundle itself stays public so the login page can load.
    const dashboard = await call(ctx, "GET", "/");
    assert.equal(dashboard.status, 200);
  });
});

// ---------------------------------------------------------------------------
// 2. Login
// ---------------------------------------------------------------------------

test("a correct credential issues a session cookie, a CSRF cookie and a token", async () => {
  await withApp({}, { login: false }, async (ctx) => {
    const res = await call(ctx, "POST", "/api/auth/login", {
      body: { username: USERNAME, password: PASSWORD },
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.authenticated, true);
    assert.equal(res.body.user, USERNAME);
    assert.equal(typeof res.body.csrfToken, "string");
    assert.ok(res.body.csrfToken.length >= 32);
    assert.ok(!res.raw.includes(PASSWORD), "the response must never echo the password");

    const cookies = res.res.headers.getSetCookie();
    const sid = cookies.find((c) => c.startsWith("tas.sid="));
    const csrf = cookies.find((c) => c.startsWith("tas.csrf="));
    assert.ok(sid, `expected a tas.sid cookie, got ${cookies.join(" | ")}`);
    assert.match(sid, /HttpOnly/i, "the session cookie must not be readable by script");
    assert.match(sid, /SameSite=Lax/i);
    assert.ok(!/Secure/i.test(sid), "the default baseline is plain HTTP on loopback");
    assert.ok(csrf, "expected a tas.csrf cookie");
    assert.ok(
      !/HttpOnly/i.test(csrf),
      "the dashboard has to read the CSRF cookie to echo it back"
    );
    assert.match(csrf, /SameSite=Lax/i);
    assert.ok(!sid.includes(PASSWORD) && !csrf.includes(PASSWORD));

    const cookie = cookies.map((c) => c.split(";")[0]).join("; ");
    const models = await call(ctx, "GET", "/api/models", { headers: { Cookie: cookie } });
    assert.equal(models.status, 200, `an authenticated call must be served: ${models.raw}`);
  });
});

test("a wrong password and a wrong username are refused identically", async () => {
  await withApp({}, { login: false }, async (ctx) => {
    const wrongPassword = await call(ctx, "POST", "/api/auth/login", {
      body: { username: USERNAME, password: "not-the-password" },
    });
    const wrongUsername = await call(ctx, "POST", "/api/auth/login", {
      body: { username: "not-the-admin", password: PASSWORD },
    });

    for (const [label, res] of [
      ["wrong password", wrongPassword],
      ["wrong username", wrongUsername],
    ]) {
      assert.equal(res.status, 401, `${label} must be refused`);
      assert.equal(res.body.error, "Invalid credentials", `${label} message`);
      assert.deepEqual(
        res.res.headers.getSetCookie(),
        [],
        `${label} must not issue a session cookie`
      );
      assert.ok(!res.raw.includes(PASSWORD), `${label} must not echo the password`);
    }
    // Byte-for-byte identical, so the response itself is not a user oracle.
    assert.equal(wrongPassword.raw, wrongUsername.raw);
  });
});

test("SESSION_COOKIE_SECURE marks the cookies Secure", async () => {
  await withApp({ SESSION_COOKIE_SECURE: "true" }, { login: false }, async (ctx) => {
    const res = await call(ctx, "POST", "/api/auth/login", {
      body: { username: USERNAME, password: PASSWORD },
    });
    assert.equal(res.status, 200);
    for (const cookie of res.res.headers.getSetCookie()) {
      assert.match(cookie, /Secure/i, `expected a Secure attribute on: ${cookie}`);
    }
  });
});

test("a pre-hashed credential is accepted without a plaintext ever being configured", async () => {
  const { hashPassword } = require("../src/server/auth/passwords");
  const hash = hashPassword("hashed-only-password");
  await withApp(
    { AUTH_ADMIN_PASSWORD: "", AUTH_ADMIN_PASSWORD_HASH: hash, AUTH_ADMIN_USERNAME: "hash-admin" },
    { login: false },
    async (ctx) => {
      const bad = await call(ctx, "POST", "/api/auth/login", {
        body: { username: "hash-admin", password: "wrong" },
      });
      assert.equal(bad.status, 401);
      const good = await call(ctx, "POST", "/api/auth/login", {
        body: { username: "hash-admin", password: "hashed-only-password" },
      });
      assert.equal(good.status, 200, good.raw);
      assert.equal(good.body.user, "hash-admin");
    }
  );
});

// ---------------------------------------------------------------------------
// 3. Session lifetime
// ---------------------------------------------------------------------------

test("a session expires once it has been idle longer than SESSION_TTL_MS", async () => {
  await withApp({ SESSION_TTL_MS: "60" }, { login: false }, async (ctx) => {
    const session = await login(ctx);
    const before = await call(ctx, "GET", "/api/models", { headers: session.headers });
    assert.equal(before.status, 200);

    await sleep(200);

    const after = await call(ctx, "GET", "/api/models", { headers: session.headers });
    assert.equal(after.status, 401, `an idle session must expire: ${after.raw}`);
    assert.equal(after.body.error, "Authentication required");
  });
});

test("a session in continuous use is never logged out spuriously", async () => {
  await withApp({ SESSION_TTL_MS: "400" }, { login: false }, async (ctx) => {
    const session = await login(ctx);
    // Six requests spaced under the idle window, spanning more than twice it:
    // a non-sliding expiry would fail here.
    for (let i = 0; i < 6; i += 1) {
      await sleep(150);
      const res = await call(ctx, "GET", "/api/models", { headers: session.headers });
      assert.equal(res.status, 200, `request ${i + 1} must still be served: ${res.raw}`);
    }
  });
});

test("SESSION_ABSOLUTE_TTL_MS caps a session that is being kept alive", async () => {
  await withApp(
    { SESSION_TTL_MS: "10000", SESSION_ABSOLUTE_TTL_MS: "300" },
    { login: false },
    async (ctx) => {
      const session = await login(ctx);
      let sawExpiry = false;
      for (let i = 0; i < 8; i += 1) {
        await sleep(80);
        const res = await call(ctx, "GET", "/api/models", { headers: session.headers });
        if (res.status === 401) {
          sawExpiry = true;
          break;
        }
        assert.equal(res.status, 200, res.raw);
      }
      assert.ok(sawExpiry, "the absolute cap must end the session despite continuous use");
    }
  );
});

// ---------------------------------------------------------------------------
// 4. Invalidation
// ---------------------------------------------------------------------------

test("logging out invalidates the session and replaying its cookie fails", async () => {
  await withApp({}, { login: false }, async (ctx) => {
    const session = await login(ctx);
    assert.equal((await call(ctx, "GET", "/api/models", { headers: session.headers })).status, 200);

    const logout = await call(ctx, "POST", "/api/auth/logout", { headers: session.headers });
    assert.equal(logout.status, 200, logout.raw);
    assert.deepEqual(logout.body, { authenticated: false });
    const cleared = logout.res.headers.getSetCookie();
    for (const name of ["tas.sid", "tas.csrf"]) {
      // The last Set-Cookie for a name is the one the browser keeps, and it
      // must be the expiring one.
      const last = cleared.filter((c) => c.startsWith(`${name}=`)).pop();
      assert.ok(last, `logout must send a ${name} cookie: ${cleared.join(" | ")}`);
      assert.match(last, /Expires=Thu, 01 Jan 1970/, `logout must expire ${name}: ${last}`);
      assert.match(last, new RegExp(`^${name.replace(".", "\\.")}=;`), `${name} must be emptied: ${last}`);
    }

    const replay = await call(ctx, "GET", "/api/models", { headers: session.headers });
    assert.equal(replay.status, 401, "a destroyed session must not be replayable");

    const state = await call(ctx, "GET", "/api/auth/session", {
      headers: { Cookie: session.cookie },
    });
    assert.equal(state.status, 200);
    assert.deepEqual(state.body, { authenticated: false });
  });
});

test("GET /api/auth/session reports a live session without a 401 storm", async () => {
  await withApp({}, { login: false }, async (ctx) => {
    const session = await login(ctx);
    const res = await call(ctx, "GET", "/api/auth/session", {
      headers: { Cookie: session.cookie },
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.authenticated, true);
    assert.equal(res.body.user, USERNAME);
    assert.equal(res.body.csrfToken, session.csrfToken);
  });
});

// ---------------------------------------------------------------------------
// 5. Configuration failure modes
// ---------------------------------------------------------------------------

test("with no administrator credential the API is closed and login answers 503", async () => {
  await withApp(
    { AUTH_ADMIN_PASSWORD: "", AUTH_ADMIN_PASSWORD_HASH: "" },
    { login: false },
    async (ctx) => {
      const login503 = await call(ctx, "POST", "/api/auth/login", {
        body: { username: "admin", password: "anything" },
      });
      assert.equal(login503.status, 503, login503.raw);
      assert.equal(login503.body.error, "Authentication is not configured");

      const models = await call(ctx, "GET", "/api/models");
      assert.equal(models.status, 401, "an unconfigured server must refuse, not open up");

      // The liveness probe still answers, so an orchestrator can still tell the
      // process apart from a dead one.
      assert.equal((await call(ctx, "GET", "/api/health")).status, 200);
    }
  );
});

test("a missing SESSION_SECRET boots with a loud warning; a configured one is silent", async () => {
  const original = console.error;
  const lines = [];
  console.error = (line) => lines.push(String(line));
  try {
    await withApp({ SESSION_SECRET: "" }, { login: false }, async (ctx) => {
      assert.equal((await call(ctx, "GET", "/api/health")).status, 200, "it must still boot");
    });
    const warning = lines.find((line) => line.includes("SESSION_SECRET is not set"));
    assert.ok(warning, `expected a SESSION_SECRET warning, got: ${lines.join(" | ")}`);
    assert.match(warning, /^\[AUTH\]/);
    assert.match(warning, /ephemeral/);
    assert.match(warning, /Set SESSION_SECRET in production/);

    lines.length = 0;
    await withApp({ SESSION_SECRET: "a-configured-secret" }, { login: false }, async (ctx) => {
      assert.equal((await call(ctx, "GET", "/api/health")).status, 200);
    });
    assert.equal(
      lines.filter((line) => line.includes("SESSION_SECRET")).length,
      0,
      `a configured secret must not warn: ${lines.join(" | ")}`
    );
    // And the secret itself is never written out.
    assert.equal(
      lines.filter((line) => line.includes("a-configured-secret")).length,
      0,
      "the secret value must never be logged"
    );
  } finally {
    console.error = original;
  }
});

test("failed logins are rate-limited without locking out a legitimate operator", async () => {
  await withApp(
    { AUTH_LOGIN_RATE_LIMIT_MAX: "3", AUTH_LOGIN_RATE_LIMIT_WINDOW_MS: "60000" },
    { login: false },
    async (ctx) => {
      for (let i = 0; i < 3; i += 1) {
        const res = await call(ctx, "POST", "/api/auth/login", {
          body: { username: USERNAME, password: "wrong" },
        });
        assert.equal(res.status, 401, `attempt ${i + 1}: ${res.raw}`);
      }
      const limited = await call(ctx, "POST", "/api/auth/login", {
        body: { username: USERNAME, password: "wrong" },
      });
      assert.equal(limited.status, 429, `the guessing run must be cut off: ${limited.raw}`);
      assert.equal(typeof limited.body.error, "string");
    }
  );

  // Successful logins do not count towards the limit, so a working dashboard
  // is never locked out by its own traffic.
  await withApp(
    { AUTH_LOGIN_RATE_LIMIT_MAX: "2", AUTH_LOGIN_RATE_LIMIT_WINDOW_MS: "60000" },
    { login: false },
    async (ctx) => {
      for (let i = 0; i < 6; i += 1) {
        const res = await call(ctx, "POST", "/api/auth/login", {
          body: { username: USERNAME, password: PASSWORD },
        });
        assert.equal(res.status, 200, `successful login ${i + 1} must not be limited`);
      }
    }
  );
});

// ---------------------------------------------------------------------------
// 6. OPTIONS is exempt only when it is a real CORS preflight
// ---------------------------------------------------------------------------

test("a bare anonymous OPTIONS does not enumerate the routing table", async () => {
  await withApp({}, { login: false }, async (ctx) => {
    // Express's built-in OPTIONS responder answers with an `Allow` header built
    // from the registered handlers, while an unrouted path 404s - so a blanket
    // exemption tells an anonymous caller which endpoints exist and which
    // methods they take, which is exactly what the deliberate 401 on unknown
    // `/api` paths exists to prevent.
    for (const path of ["/api/models", "/api/devops/status", "/api/simulation"]) {
      const res = await call(ctx, "OPTIONS", path);
      assert.equal(res.status, 401, `bare OPTIONS ${path} must be refused: ${res.raw}`);
      assert.equal(res.body.error, "Authentication required");
      assert.equal(res.res.headers.get("allow"), null, "no Allow header may leak");
    }
  });
});

test("a genuine CORS preflight is still answered without a session", async () => {
  await withApp({}, { login: false }, async (ctx) => {
    // Both headers together are what defines a preflight. Refusing it with a
    // 401 would make the browser report a CORS failure for a request that would
    // in fact have been authorised.
    const res = await call(ctx, "OPTIONS", "/api/models", {
      headers: {
        Origin: ctx.base,
        "Access-Control-Request-Method": "GET",
      },
    });
    assert.notEqual(res.status, 401, `a preflight must not be gated: ${res.raw}`);
    assert.ok(res.status < 400, `a preflight must be answered: ${res.status} ${res.raw}`);
  });
});
