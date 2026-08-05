/**
 * End-to-end security regression suite (issue #8).
 *
 * Starts a REAL server instance as a child process and drives it over HTTP -
 * it never imports the Express app or calls handlers in-process. It proves the
 * filesystem-containment (GHSA-4qmg-22w8-qmj4), name-sanitisation
 * (GHSA-9348-cgrv-c89w) and CORS (GHSA-m5x4-v76j-c4qq) fixes hold against a
 * running instance, and that legitimate topology flows still succeed.
 */
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const {
  startServer,
  request,
  unique,
  repoPackageJson,
  modelsDir,
  recordersDir,
  inModelsDir,
  escapeArtifacts,
  removeIfPresent,
  listDir,
  allowedOrigin,
  hostileOrigin,
} = require("./helpers");

/** Hostile base names this suite tries to write outside the storage root. */
const escapeNames = ["escape", "pwned"];

let server;

before(async () => {
  // Configure the real instance with the trusted origin shipped in tests.
  server = await startServer({ CORS_ALLOWED_ORIGINS: allowedOrigin });
});

after(async () => {
  if (server) await server.stop();
  // This suite is the regression gate, so it runs red against an unfixed
  // instance - which really does escape files into the source tree. Remove
  // them so a failing run never leaves the checkout dirty.
  for (const name of escapeNames) {
    escapeArtifacts(name).forEach(removeIfPresent);
  }
});

// ---------------------------------------------------------------------------
// A real instance is started and driven over HTTP
// ---------------------------------------------------------------------------

test("suite drives a real running instance over HTTP", async () => {
  const res = await request(server.baseUrl, "GET", "/");
  assert.equal(
    res.status,
    200,
    "dashboard root must be served by the real instance"
  );
  const api = await request(server.baseUrl, "GET", "/api/models/");
  assert.equal(api.status, 200, "API must be reachable over HTTP");
  assert.equal(api.body.error, null);
});

// ---------------------------------------------------------------------------
// Hostile names - every affected route family rejects them with no file
// read, written or removed. Payload corpus mirrors GHSA guidance.
// ---------------------------------------------------------------------------

test("path containment: models GET rejects traversal with no path disclosure", async () => {
  const attempts = [
    "/api/models/..%2Fpackage.json",
    "/api/models/%2e%2e%2fpackage.json",
    "/api/models/..%2F..%2F..%2Fetc%2Fpasswd",
    "/api/models/..%2F..%2Fpackage-lock.json",
  ];
  for (const p of attempts) {
    const res = await request(server.baseUrl, "GET", p);
    assert.equal(
      res.status,
      400,
      `expected 400 for ${p}, got ${res.status} (${res.raw})`
    );
    assert.ok(
      !res.raw.includes("package.json"),
      `must not leak target: ${res.raw}`
    );
    assert.ok(
      !res.raw.includes("/home/"),
      `must not leak server paths: ${res.raw}`
    );
    assert.ok(
      !res.raw.includes("workspace"),
      `must not leak server paths: ${res.raw}`
    );
    assert.ok(
      !res.raw.includes("models/data"),
      `must not leak storage path: ${res.raw}`
    );
  }
});

test("path containment: models GET and DELETE leave files untouched", async () => {
  assert.ok(fs.existsSync(repoPackageJson), "canary must exist");
  const beforeList = await listDir(modelsDir);
  const del = await request(
    server.baseUrl,
    "DELETE",
    "/api/models/..%2Fpackage.json"
  );
  assert.equal(del.status, 400, "traversal delete must be rejected");
  assert.ok(fs.existsSync(repoPackageJson), "canary must NOT be deleted");
  const get = await request(
    server.baseUrl,
    "GET",
    "/api/models/%2e%2e%2fpackage.json"
  );
  assert.equal(get.status, 400, "traversal read must be rejected");
  const afterList = await listDir(modelsDir);
  assert.deepEqual(
    afterList,
    beforeList,
    "no file written or removed in the models dir"
  );
});

test("path containment: data-recorders GET and DELETE reject traversal", async () => {
  assert.ok(fs.existsSync(repoPackageJson));
  const beforeList = await listDir(recordersDir);
  const get = await request(
    server.baseUrl,
    "GET",
    "/api/data-recorders/models/..%2Fpackage.json"
  );
  assert.equal(get.status, 400);
  assert.ok(!get.raw.includes("workspace"));
  const del = await request(
    server.baseUrl,
    "DELETE",
    "/api/data-recorders/models/..%2Fpackage.json"
  );
  assert.equal(del.status, 400);
  assert.ok(fs.existsSync(repoPackageJson), "canary must not be deleted");
  assert.deepEqual(
    await listDir(recordersDir),
    beforeList,
    "recorders dir untouched"
  );
});

test("path containment: logs GET and DELETE reject traversal across all log families", async () => {
  assert.ok(fs.existsSync(repoPackageJson));
  const families = ["data-recorders", "simulations", "test-campaigns"];
  for (const family of families) {
    const target = `/api/logs/${family}/..%2Fpackage.json`;
    const get = await request(server.baseUrl, "GET", target);
    assert.equal(get.status, 400, `${family} GET must be rejected`);
    assert.ok(!get.raw.includes("package.json"), `${family} GET must not leak`);
    const del = await request(server.baseUrl, "DELETE", target);
    assert.equal(del.status, 400, `${family} DELETE must be rejected`);
  }
  assert.ok(fs.existsSync(repoPackageJson), "canary must not be deleted");
});

test("path containment: simulation start rejects a hostile modelFileName in the body", async () => {
  const res = await request(server.baseUrl, "POST", "/api/simulation/start", {
    body: {
      modelFileName: "..%2Fpackage.json",
      model: { name: unique("sim"), devices: [] },
    },
  });
  assert.equal(
    res.status,
    400,
    "hostile simulation modelFileName must be rejected"
  );
  assert.ok(fs.existsSync(repoPackageJson));
});

test("path containment: data-recorders start rejects a hostile dataRecorderFileName in the body", async () => {
  const res = await request(
    server.baseUrl,
    "POST",
    "/api/data-recorders/start",
    {
      body: {
        dataRecorderFileName: "../../package.json",
        model: { name: unique("dr"), dataRecorders: [] },
      },
    }
  );
  assert.equal(
    res.status,
    400,
    "hostile recorder dataRecorderFileName must be rejected"
  );
  assert.ok(fs.existsSync(repoPackageJson));
});

// ---------------------------------------------------------------------------
// Hostile names - name allowlist (create/rename) rejects and writes nothing
// ---------------------------------------------------------------------------

test("name sanitisation: creating a model with a hostile name writes no file", async () => {
  const beforeList = await listDir(modelsDir);
  const hostile = [
    "../../escape",
    "..%2Fescape",
    "a/b",
    "a\\b",
    "..",
    ".",
    "x".repeat(200),
  ];
  for (const name of hostile) {
    const res = await request(server.baseUrl, "POST", "/api/models", {
      body: { model: { name, devices: [] } },
    });
    assert.equal(
      res.status,
      400,
      `expected 400 for name ${JSON.stringify(name)}`
    );
  }
  // Check every directory a `../` payload actually reaches from the storage
  // root, not just the storage root and the repo root.
  for (const artifact of escapeArtifacts("escape")) {
    assert.ok(
      !fs.existsSync(artifact),
      `hostile name must not write ${artifact}`
    );
  }
  assert.deepEqual(
    await listDir(modelsDir),
    beforeList,
    "no file written or removed"
  );
});

test("name sanitisation: hostile rename is rejected and leaves the original file", async () => {
  const name = unique("ren");
  const created = await request(server.baseUrl, "POST", "/api/models", {
    body: { model: { name, devices: [] } },
  });
  assert.equal(created.status, 200);
  const fileName = created.body.modelFileName;
  try {
    const res = await request(
      server.baseUrl,
      "POST",
      `/api/models/${fileName}`,
      {
        body: { model: { name: "../../pwned", devices: [] } },
      }
    );
    assert.equal(res.status, 400, "hostile rename must be rejected");
    assert.ok(
      fs.existsSync(inModelsDir(fileName)),
      "original file must be untouched"
    );
    for (const artifact of escapeArtifacts("pwned")) {
      assert.ok(
        !fs.existsSync(artifact),
        `hostile rename must not write ${artifact}`
      );
    }
  } finally {
    await request(server.baseUrl, "DELETE", `/api/models/${fileName}`);
  }
});

// ---------------------------------------------------------------------------
// Cross-origin access control
// ---------------------------------------------------------------------------

test("CORS: requests from an unlisted origin are rejected", async () => {
  const res = await request(server.baseUrl, "GET", "/api/models/", {
    headers: { Origin: hostileOrigin },
  });
  assert.equal(res.status, 403, "unlisted origin must be rejected");
  assert.equal(res.body.error, "Origin not allowed");
});

test("CORS: requests from an allowlisted origin are served with an explicit header", async () => {
  const res = await request(server.baseUrl, "GET", "/api/models/", {
    headers: { Origin: allowedOrigin },
  });
  assert.equal(res.status, 200, "allowlisted origin must be served");
  assert.equal(res.headers["access-control-allow-origin"], allowedOrigin);
});

test("CORS: same-origin requests are served", async () => {
  const sameOrigin = `http://127.0.0.1:${server.port}`;
  const res = await request(server.baseUrl, "GET", "/api/models/", {
    headers: { Origin: sameOrigin },
  });
  assert.equal(res.status, 200, "same-origin request must be served");
});

test("CORS: OPTIONS preflight from an allowed origin is accepted", async () => {
  const res = await request(server.baseUrl, "OPTIONS", "/api/models/", {
    headers: {
      Origin: allowedOrigin,
      "Access-Control-Request-Method": "GET",
    },
  });
  assert.equal(
    res.status,
    204,
    "preflight from allowed origin must be accepted"
  );
});

// ---------------------------------------------------------------------------
// Legitimate flows - list, read, create, rename, delete a topology
// ---------------------------------------------------------------------------

test("legitimate topology lifecycle: list, read, create, rename, delete", async () => {
  const name = unique("topo");
  assert.equal(
    (await request(server.baseUrl, "GET", "/api/models/")).status,
    200
  );

  const create = await request(server.baseUrl, "POST", "/api/models", {
    body: { model: { name, devices: [] } },
  });
  assert.equal(create.status, 200, "create must succeed");
  const fileName = create.body.modelFileName;
  assert.ok(fileName, "expected a modelFileName");
  assert.ok(fs.existsSync(inModelsDir(fileName)), "created file must exist");

  const read = await request(server.baseUrl, "GET", `/api/models/${fileName}`);
  assert.equal(read.status, 200, "read must succeed");
  assert.equal(read.body.error, null);
  assert.equal(read.body.model.name, name);

  const renamed = `${name}-renamed`;
  const rename = await request(
    server.baseUrl,
    "POST",
    `/api/models/${fileName}`,
    {
      body: { model: { name: renamed, devices: [] } },
    }
  );
  assert.equal(rename.status, 200, "rename must succeed");
  assert.ok(
    !fs.existsSync(inModelsDir(fileName)),
    "old file must be removed on rename"
  );
  assert.ok(
    fs.existsSync(inModelsDir(`${renamed}.json`)),
    "renamed file must exist"
  );

  const del = await request(
    server.baseUrl,
    "DELETE",
    `/api/models/${renamed}.json`
  );
  assert.equal(del.status, 200, "delete must succeed");
  assert.ok(
    !fs.existsSync(inModelsDir(`${renamed}.json`)),
    "deleted file must be gone"
  );
});
