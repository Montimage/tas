/**
 * Cross-site request forgery protection (issue #9, AC4).
 *
 * A session cookie is attached by the browser to any request that reaches this
 * origin, including one an unrelated page caused - so the cookie alone cannot
 * be what authorises a state-changing call. These tests pin the second factor:
 * the token bound to the server-side session, which a cross-site page can never
 * read and therefore never send.
 */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { startApp, TEST_CREDENTIALS } = require("./helpers/start-app");
const { isMutatingSafeMethodPath } = require("../src/server/middleware/csrf");

const USERNAME = TEST_CREDENTIALS.AUTH_ADMIN_USERNAME;
const PASSWORD = TEST_CREDENTIALS.AUTH_ADMIN_PASSWORD;

/**
 * Issue a request and read the response.
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
 * Run a block against a freshly started, logged-in instance.
 * @param {Function} fn Receives (ctx, session)
 * @returns {Promise<void>}
 */
async function withSession(fn) {
  const ctx = await startApp({}, { login: false });
  try {
    const res = await call(ctx, "POST", "/api/auth/login", {
      body: { username: USERNAME, password: PASSWORD },
    });
    assert.equal(res.status, 200, res.raw);
    const cookie = res.res.headers
      .getSetCookie()
      .map((value) => value.split(";")[0])
      .join("; ");
    await fn(ctx, { cookie, csrfToken: res.body.csrfToken });
  } finally {
    await new Promise((resolve) => ctx.server.close(resolve));
    ctx.restore();
  }
}

test("a state-changing request without the CSRF header is refused", async () => {
  await withSession(async (ctx, session) => {
    const res = await call(ctx, "POST", "/api/data-storage", {
      headers: { Cookie: session.cookie },
      body: { dataStorage: { type: "MongoDB", host: "localhost", port: 27017 } },
    });
    assert.equal(res.status, 403, `expected a CSRF rejection, got ${res.status}: ${res.raw}`);
    assert.equal(res.body.error, "Invalid CSRF token");
  });
});

test("a state-changing request with the wrong CSRF token is refused", async () => {
  await withSession(async (ctx, session) => {
    for (const token of ["not-the-token", "", session.csrfToken + "x", session.csrfToken.slice(1)]) {
      const res = await call(ctx, "POST", "/api/data-storage", {
        headers: { Cookie: session.cookie, "X-CSRF-Token": token },
        body: { dataStorage: { type: "MongoDB", host: "localhost", port: 27017 } },
      });
      assert.equal(res.status, 403, `token ${JSON.stringify(token)}: ${res.raw}`);
      assert.equal(res.body.error, "Invalid CSRF token");
    }
  });
});

test("the correct CSRF token lets the dashboard's own request through", async () => {
  await withSession(async (ctx, session) => {
    // What is asserted is that CSRF did NOT reject it. The route itself may
    // still answer 400/404/500 depending on the payload and on whether a
    // database is reachable - that is not this middleware's business.
    const post = await call(ctx, "POST", "/api/data-storage", {
      headers: { Cookie: session.cookie, "X-CSRF-Token": session.csrfToken },
      body: { dataStorage: { type: "MongoDB", host: "localhost", port: 27017 } },
    });
    assert.notEqual(post.status, 403, `a correctly tokened POST must not be refused: ${post.raw}`);
    assert.notEqual(post.body && post.body.error, "Invalid CSRF token");

    const del = await call(ctx, "DELETE", "/api/models/no-such-model.json", {
      headers: { Cookie: session.cookie, "X-CSRF-Token": session.csrfToken },
    });
    assert.notEqual(del.status, 403, `a correctly tokened DELETE must not be refused: ${del.raw}`);
  });
});

test("a DELETE without the CSRF header is refused", async () => {
  await withSession(async (ctx, session) => {
    const res = await call(ctx, "DELETE", "/api/models/no-such-model.json", {
      headers: { Cookie: session.cookie },
    });
    assert.equal(res.status, 403, res.raw);
    assert.equal(res.body.error, "Invalid CSRF token");
  });
});

test("safe methods never require the CSRF header", async () => {
  await withSession(async (ctx, session) => {
    for (const path of ["/api/models", "/api/devops/status", "/api/auth/session"]) {
      const res = await call(ctx, "GET", path, { headers: { Cookie: session.cookie } });
      assert.notEqual(res.status, 403, `${path} must not require a token for GET: ${res.raw}`);
    }
  });
});

test("the forged cross-site POST - session cookie, attacker-chosen token - is refused", async () => {
  await withSession(async (ctx, session) => {
    // Exactly what a hostile page can produce: the browser attaches the session
    // cookie, and the page supplies whatever header value it likes (it cannot
    // read the real token, because the same-origin policy stops it).
    const forged = await call(ctx, "POST", "/api/models", {
      headers: {
        Cookie: session.cookie,
        Origin: ctx.base,
        "X-CSRF-Token": "value-chosen-by-the-attacker",
      },
      body: { model: { name: "forged", devices: [] } },
    });
    assert.equal(forged.status, 403, `a forged POST must be refused: ${forged.raw}`);
    assert.equal(forged.body.error, "Invalid CSRF token");

    // And with no header at all - the plain cross-site form post.
    const noHeader = await call(ctx, "POST", "/api/models", {
      headers: { Cookie: session.cookie },
      body: { model: { name: "forged", devices: [] } },
    });
    assert.equal(noHeader.status, 403, `a headerless POST must be refused: ${noHeader.raw}`);
  });
});

test("a token from a different session does not authorise a request", async () => {
  await withSession(async (ctx, session) => {
    const second = await call(ctx, "POST", "/api/auth/login", {
      body: { username: USERNAME, password: PASSWORD },
    });
    assert.equal(second.status, 200, second.raw);
    assert.notEqual(second.body.csrfToken, session.csrfToken, "each session gets its own token");

    const res = await call(ctx, "POST", "/api/models", {
      headers: { Cookie: session.cookie, "X-CSRF-Token": second.body.csrfToken },
      body: { model: { name: "crossed", devices: [] } },
    });
    assert.equal(res.status, 403, `a token from another session must not work: ${res.raw}`);
  });
});

test("login itself is exempt, because it is what issues the token", async () => {
  const ctx = await startApp({}, { login: false });
  try {
    const res = await fetch(ctx.base + "/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: USERNAME, password: PASSWORD }),
    });
    assert.equal(res.status, 200, "login must not require a token it has not issued yet");
  } finally {
    await new Promise((resolve) => ctx.server.close(resolve));
    ctx.restore();
  }
});

// ---------------------------------------------------------------------------
// The endpoints that mutate over a safe method
// ---------------------------------------------------------------------------

/**
 * Endpoints that change state over `GET`. They predate the method-based rule
 * and `SameSite=Lax` does not cover them: the cookie is still attached to a
 * top-level `GET` navigation, so a link on any page an operator visits while
 * logged in would otherwise reach them with full authority.
 */
const MUTATING_GETS = [
  "/api/devops/start",
  "/api/devops/stop",
  "/api/simulation/stop/anything.json",
  "/api/data-recorders/stop/anything.json",
];

test("state-changing GET endpoints require the CSRF token too", async () => {
  await withSession(async (ctx, session) => {
    for (const path of MUTATING_GETS) {
      const res = await call(ctx, "GET", path, {
        headers: { Cookie: session.cookie },
      });
      assert.equal(
        res.status,
        403,
        `${path} mutates, so a tokenless GET must be refused: ${res.status} ${res.raw}`
      );
      assert.equal(res.body.error, "Invalid CSRF token");
    }
  });
});

test("the same endpoints are reachable once the token is sent", async () => {
  await withSession(async (ctx, session) => {
    // `/api/devops/start` is left out: it reaches for the configured data
    // storage and blocks until that connection attempt times out, which says
    // nothing about the guard under test here. Its refusal without a token is
    // asserted above, which is the property this pair exists to pin.
    for (const path of MUTATING_GETS.filter((p) => p !== "/api/devops/start")) {
      const res = await call(ctx, "GET", path, {
        headers: { Cookie: session.cookie, "X-CSRF-Token": session.csrfToken },
      });
      assert.notEqual(
        res.status,
        403,
        `${path} must still work for the dashboard: ${res.status} ${res.raw}`
      );
    }
  });
});

test("the mutating-GET list is matched case-insensitively, as Express routes are", async () => {
  await withSession(async (ctx, session) => {
    // `/api/DevOps/stop` reaches the same handler, so a case-sensitive list
    // would be a way straight around the check.
    const res = await call(ctx, "GET", "/api/DevOps/stop", {
      headers: { Cookie: session.cookie },
    });
    assert.equal(res.status, 403, `case variation must not evade the check: ${res.raw}`);
  });
});

test("a forged CORS preflight cannot enumerate the routing table", async () => {
  await startApp({}, { login: false }).then(async (ctx) => {
    try {
      // The two headers that define a preflight are trivially forged by a
      // non-browser client. The exemption must therefore stop at answering the
      // preflight: passing it on hands Express's own OPTIONS responder an
      // anonymous caller, and its `Allow` header - plus the 404 an unrouted
      // path gets - maps every endpoint and the methods it takes.
      const probes = ["/api/models", "/api/models/x.json", "/api/devops/start", "/api/nope"];
      const seen = new Set();
      for (const path of probes) {
        const res = await call(ctx, "OPTIONS", path, {
          headers: { Origin: ctx.base, "Access-Control-Request-Method": "GET" },
        });
        assert.equal(res.status, 204, `${path} preflight must be answered here: ${res.raw}`);
        assert.equal(res.res.headers.get("allow"), null, `${path} must not leak an Allow header`);
        seen.add(res.status);
      }
      assert.equal(seen.size, 1, "an existing path must not be distinguishable from an unknown one");
    } finally {
      await new Promise((resolve) => ctx.server.close(resolve));
      ctx.restore();
    }
  });
});

// ---------------------------------------------------------------------------
// The mutating-safe-method list must not silently fall behind the routers
// ---------------------------------------------------------------------------

/**
 * Every `GET`/`HEAD` route under `/api` that has been read and found to change
 * nothing a caller can see or choose, as its `/api`-relative path.
 *
 * "Read-only" is meant at the level this guard is about: several of these do
 * refresh a module-level cache, a running-status flag or a lazily opened
 * database connection. None of them takes a payload, creates or destroys
 * anything, or does something a cross-site page would gain by triggering. What
 * disqualifies a route from this list is state a caller supplies or chooses.
 *
 * This is the counterpart to `MUTATING_SAFE_METHOD_PATHS` in the CSRF guard:
 * between them, the two lists have to account for every safe-method route the
 * application mounts. A route added later belongs to one or the other and the
 * test below fails until somebody says which — which is the point, because the
 * failure mode it guards is a new `GET /reset` that nothing refuses and no test
 * notices.
 */
const READ_ONLY_SAFE_ROUTES = new Set([
  "/auth/session",
  "/data-recorders/models",
  "/data-recorders/models/:fileName",
  "/data-recorders/status",
  "/data-sets",
  "/data-sets/:datasetId",
  "/data-storage",
  "/data-storage/test",
  "/devops",
  "/devops/status",
  "/events",
  "/events/:eventId",
  "/health",
  "/logs/data-recorders",
  "/logs/data-recorders/:fileName",
  "/logs/simulations",
  "/logs/simulations/:fileName",
  "/logs/test-campaigns",
  "/logs/test-campaigns/:fileName",
  "/models",
  "/models/:fileName",
  "/reports",
  "/reports/:reportId",
  "/simulation/stats",
  "/simulation/status",
  "/test-campaigns",
  "/test-campaigns/:testCampaignId",
  "/test-cases",
  "/test-cases/:testCaseId",
]);

/**
 * Recover the path a layer was mounted at from the regexp Express compiled for
 * it. Express keeps no copy of the original string, and reading the live stack
 * is the only way to see what the guard actually sees: a source-text scan would
 * miss a computed path, a `router.route(...)`, a route registered outside
 * `src/server/routes/`, and every extra mount of a router mounted more than
 * once — each of which is a way for an unprotected route to ship green.
 *
 * @param {Object} layer An Express router-stack layer
 * @returns {String} The mount path, or "" for a layer that matches everything
 */
function layerPath(layer) {
  if (layer.regexp && layer.regexp.fast_slash) return "";
  const source = String((layer.regexp && layer.regexp.source) || "");
  const trimmed = source
    .replace(/^\^/, "")
    .replace(/\\\/\?\(\?=\\\/\|\$\)$/, "")
    .replace(/\\\/\?\$$/, "")
    .replace(/\$$/, "");
  return trimmed.replace(/\\(.)/g, "$1");
}

/**
 * Walk a mounted Express application and yield every route it can reach.
 *
 * @param {Object} stack A router stack
 * @param {String} prefix The path this stack is mounted at
 * @returns {Array<{path: String, methods: Object}>} The routes found
 */
function collectRoutes(stack, prefix) {
  const found = [];
  for (const layer of stack || []) {
    if (layer.route) {
      const routePath = layer.route.path === "/" ? "" : layer.route.path;
      found.push({
        path: (prefix + routePath).replace(/\/+$/, "") || "/",
        methods: layer.route.methods || {},
      });
    } else if (layer.handle && layer.handle.stack) {
      found.push(...collectRoutes(layer.handle.stack, prefix + layerPath(layer)));
    }
  }
  return found;
}

test("every safe-method route under /api is classified read-only or token-bearing", async () => {
  // Boot the real application so the route table is the one the guard sees.
  const appPath = require.resolve("../src/server/app.js");
  const saved = {};
  const env = {
    AUTH_ADMIN_USERNAME: USERNAME,
    AUTH_ADMIN_PASSWORD: PASSWORD,
    SESSION_SECRET: "route-walk-secret",
  };
  Object.keys(env).forEach((key) => {
    saved[key] = process.env[key];
    process.env[key] = env[key];
  });
  delete require.cache[appPath];
  delete require.cache[require.resolve("../src/server/config.js")];
  let app;
  try {
    app = require(appPath);
  } finally {
    Object.keys(saved).forEach((key) => {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    });
    delete require.cache[appPath];
    delete require.cache[require.resolve("../src/server/config.js")];
  }

  const router = app._router || app.router;
  assert.ok(router && router.stack, "the Express route table must be reachable");

  const safeApiRoutes = collectRoutes(router.stack, "")
    .filter((route) => route.path === "/api" || route.path.startsWith("/api/"))
    .filter((route) => route.methods.get || route.methods.head)
    .map((route) => route.path.slice("/api".length) || "/");

  assert.ok(
    safeApiRoutes.length > 20,
    `the walk must actually find routes, found ${safeApiRoutes.length}`
  );

  const seen = new Set();
  const unclassified = [];
  for (const path of safeApiRoutes) {
    if (READ_ONLY_SAFE_ROUTES.has(path)) {
      seen.add(path);
      continue;
    }
    // Checked with the parameter left in place *and* filled in, because the
    // guard matches a concrete request path at runtime.
    const concrete = path.replace(/:[^/]+/g, "placeholder.json");
    if (isMutatingSafeMethodPath(path) && isMutatingSafeMethodPath(concrete)) continue;
    unclassified.push(path);
  }

  assert.deepEqual(
    [...new Set(unclassified)].sort(),
    [],
    "a safe-method route under /api is neither on the reviewed read-only list nor " +
      "covered by the CSRF guard's mutating-path list - classify it in one of the " +
      "two, and if it changes state add it to MUTATING_SAFE_METHOD_PATHS in " +
      "src/server/middleware/csrf.js"
  );

  // A stale entry is a pre-authorisation for a route nobody reviewed: it would
  // wave through a future route that happens to reuse the path.
  assert.deepEqual(
    [...READ_ONLY_SAFE_ROUTES].filter((path) => !seen.has(path)).sort(),
    [],
    "READ_ONLY_SAFE_ROUTES lists a path that no longer exists - remove it"
  );
});
