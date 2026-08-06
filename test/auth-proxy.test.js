/**
 * Reverse-proxy identity delegation (issue #9, AC5).
 *
 * A deployment that already sits behind an authenticating proxy should be able
 * to delegate identity to it rather than maintain a second credential. The
 * danger is that the mechanism - a request header - is trivially forgeable by
 * anyone who can reach the port, so the feature is only ever the intended one
 * when the peer address is pinned as well.
 *
 * These tests pin all four states: off (the default), on but unpinned, on and
 * correctly pinned, and on but pinned to somebody else.
 */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { startApp } = require("./helpers/start-app");

/**
 * Issue a request and read the response.
 * @param {Object} ctx Started application context
 * @param {String} method HTTP method
 * @param {String} path Request path
 * @param {Object} [headers] Request headers
 * @returns {Promise<{status:Number,body:Object|null,raw:String,res:Response}>}
 */
async function call(ctx, method, path, headers = {}) {
  const res = await fetch(ctx.base + path, { method, headers });
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
 * Run a block against a freshly started instance.
 * @param {Object} env Environment overrides
 * @param {Function} fn Receives the started context
 * @returns {Promise<void>}
 */
async function withApp(env, fn) {
  const ctx = await startApp(env, { login: false });
  try {
    await fn(ctx);
  } finally {
    await new Promise((resolve) => ctx.server.close(resolve));
    ctx.restore();
  }
}

test("with delegation off (the default) a proxy identity header is completely inert", async () => {
  await withApp({}, async (ctx) => {
    for (const header of [
      { "X-Forwarded-User": "test-admin" },
      { "x-forwarded-user": "admin" },
      { "X-Forwarded-User": "test-admin", "X-Forwarded-For": "127.0.0.1" },
      { "X-Remote-User": "test-admin" },
    ]) {
      const res = await call(ctx, "GET", "/api/models", header);
      assert.equal(
        res.status,
        401,
        `${JSON.stringify(header)} must not authenticate anything: ${res.raw}`
      );
      assert.equal(res.body.error, "Authentication required");
      assert.deepEqual(
        res.res.headers.getSetCookie(),
        [],
        "a spoofed header must not mint a session"
      );
    }
  });
});

test("the flag alone, with no trusted proxies, leaves delegation disabled and warns", async () => {
  const original = console.error;
  const lines = [];
  console.error = (line) => lines.push(String(line));
  try {
    await withApp({ AUTH_TRUST_PROXY_HEADER: "true", AUTH_TRUSTED_PROXIES: "" }, async (ctx) => {
      const res = await call(ctx, "GET", "/api/models", { "X-Forwarded-User": "test-admin" });
      assert.equal(res.status, 401, `delegation must stay off without a peer list: ${res.raw}`);
    });
  } finally {
    console.error = original;
  }
  const warning = lines.find((line) => line.includes("AUTH_TRUST_PROXY_HEADER"));
  assert.ok(warning, `expected a startup warning, got: ${lines.join(" | ")}`);
  assert.match(warning, /^\[AUTH\]/);
  assert.match(warning, /AUTH_TRUSTED_PROXIES is empty/);
  assert.match(warning, /stays disabled/);
});

test("a trusted peer's identity header authenticates and is given a real session", async () => {
  await withApp(
    { AUTH_TRUST_PROXY_HEADER: "true", AUTH_TRUSTED_PROXIES: "127.0.0.1" },
    async (ctx) => {
      const res = await call(ctx, "GET", "/api/models", { "X-Forwarded-User": "proxy-operator" });
      assert.equal(res.status, 200, `a trusted peer must be believed: ${res.raw}`);

      const cookies = res.res.headers.getSetCookie();
      assert.ok(
        cookies.some((c) => c.startsWith("tas.sid=")),
        `a delegated identity must get a session cookie: ${cookies.join(" | ")}`
      );
      assert.ok(
        cookies.some((c) => c.startsWith("tas.csrf=")),
        "a delegated identity must get a CSRF token too"
      );

      // The session it was given is a real one: it identifies the proxy-supplied
      // user and works on its own afterwards.
      const cookie = cookies.map((c) => c.split(";")[0]).join("; ");
      const session = await call(ctx, "GET", "/api/auth/session", { Cookie: cookie });
      assert.equal(session.status, 200);
      assert.equal(session.body.authenticated, true);
      assert.equal(session.body.user, "proxy-operator");
    }
  );
});

test("a header from an untrusted peer address is ignored", async () => {
  await withApp(
    { AUTH_TRUST_PROXY_HEADER: "true", AUTH_TRUSTED_PROXIES: "10.9.8.7, 192.0.2.10" },
    async (ctx) => {
      const res = await call(ctx, "GET", "/api/models", { "X-Forwarded-User": "test-admin" });
      assert.equal(res.status, 401, `only the listed peers may delegate: ${res.raw}`);
      assert.deepEqual(res.res.headers.getSetCookie(), []);
    }
  );
});

test("an empty identity header from a trusted peer does not authenticate", async () => {
  await withApp(
    { AUTH_TRUST_PROXY_HEADER: "true", AUTH_TRUSTED_PROXIES: "127.0.0.1" },
    async (ctx) => {
      assert.equal((await call(ctx, "GET", "/api/models", { "X-Forwarded-User": "  " })).status, 401);
      assert.equal((await call(ctx, "GET", "/api/models")).status, 401);
    }
  );
});

test("the identity header name is configurable, and only that name is honoured", async () => {
  await withApp(
    {
      AUTH_TRUST_PROXY_HEADER: "true",
      AUTH_TRUSTED_PROXIES: "127.0.0.1",
      AUTH_PROXY_USER_HEADER: "x-remote-user",
    },
    async (ctx) => {
      const wrongName = await call(ctx, "GET", "/api/models", { "X-Forwarded-User": "someone" });
      assert.equal(wrongName.status, 401, "the default header must stop being honoured");

      const rightName = await call(ctx, "GET", "/api/models", { "X-Remote-User": "someone" });
      assert.equal(rightName.status, 200, rightName.raw);
    }
  );
});

test("normalizeAddress unwraps IPv4-mapped peers without conflating loopbacks", () => {
  const { normalizeAddress } = require("../src/server/middleware/auth");
  assert.equal(normalizeAddress("::ffff:127.0.0.1"), "127.0.0.1");
  assert.equal(normalizeAddress("::FFFF:10.0.0.5"), "10.0.0.5");
  assert.equal(normalizeAddress("127.0.0.1"), "127.0.0.1");
  // ::1 and 127.0.0.1 are different addresses; folding them together would
  // silently widen a configured trusted-peer list.
  assert.equal(normalizeAddress("::1"), "::1");
  assert.equal(normalizeAddress(undefined), "");
});

test("the public allowlist is exactly the three documented routes", () => {
  const { PUBLIC_API_ROUTES } = require("../src/server/middleware/auth");
  assert.deepEqual(PUBLIC_API_ROUTES, [
    { method: "GET", path: "/health" },
    { method: "POST", path: "/auth/login" },
    { method: "GET", path: "/auth/session" },
  ]);
});
