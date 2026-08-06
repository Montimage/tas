const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const express = require("express");
const { request } = require("./_http");

const modelRouter = require("../src/server/routes/model");
const dataRecorderRouter = require("../src/server/routes/data-recorders");
const simulationRouter = require("../src/server/routes/simulation");
const createLogRouter = require("../src/server/routes/logs");
const testCasesRouter = require("../src/server/routes/test-cases");
const testCampaignRouter = require("../src/server/routes/test-campaigns");
const dataSetRouter = require("../src/server/routes/data-sets");
const eventRouter = require("../src/server/routes/events");
const reportRouter = require("../src/server/routes/reports");
const dataStorageRouter = require("../src/server/routes/data-storage");
const devopsRouter = require("../src/server/routes/devops");
const { NAME_MAX_LENGTH } = require("../src/server/routes/path-safety");

const modelsDir = path.resolve(__dirname, "../src/server/data/models");
const dataRecordersDir = path.resolve(__dirname, "../src/server/data/data-recorders");
const devopsFile = path.resolve(__dirname, "../src/server/data/devops.json");
const dataStorageFile = path.resolve(__dirname, "../src/server/data/data-storage.json");
const simulationLogsDir = path.resolve(__dirname, "../src/server/logs/simulations");

let server;
let app;
let originalDevops;

before(() => {
  // The devops write path is exercised below and overwrites the shipped
  // configuration; snapshot it so the checkout is left unchanged.
  originalDevops = fs.readFileSync(devopsFile, "utf8");

  // `GET /api/logs/simulations` lists this directory, but nothing under
  // `src/server/logs` is tracked (`*.log` is gitignored) and no code creates it
  // up front -- it only appears once a simulation has run. On a fresh checkout
  // (CI) it is absent, the route answers "Cannot read the logs directory" and
  // serves no `files` array, so create it before the listing test asserts.
  fs.mkdirSync(simulationLogsDir, { recursive: true });

  app = express();
  app.use(express.json());
  // Deliberately left on Express's default ("extended") query parser, which is
  // what turns `?a[$ne]=1` into an object. The schemas have to reject that on
  // their own — `app.js` additionally switches the parser off, and that is
  // asserted separately below.
  app.use("/api/models", modelRouter);
  app.use("/api/data-recorders", dataRecorderRouter);
  app.use("/api/simulation", simulationRouter);
  app.use("/api/logs/simulations", createLogRouter("simulations"));
  app.use("/api/test-cases", testCasesRouter);
  app.use("/api/test-campaigns", testCampaignRouter);
  app.use("/api/data-sets", dataSetRouter);
  app.use("/api/events", eventRouter);
  app.use("/api/reports", reportRouter);
  app.use("/api/data-storage", dataStorageRouter);
  app.use("/api/devops", devopsRouter);
  server = app.listen(0);
});

after(() => {
  server.close();
  if (originalDevops !== undefined) fs.writeFileSync(devopsFile, originalDevops);
});

const unique = (prefix) => `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

/**
 * Assert the standard machine-readable validation failure shape.
 */
const assertValidationError = (res, context = "") => {
  assert.equal(res.status, 400, `expected 400 for ${context}, got ${res.status} (${res.raw})`);
  assert.equal(res.body.error, "Validation failed", `unexpected error text: ${res.raw}`);
  assert.ok(Array.isArray(res.body.details), `details must be an array: ${res.raw}`);
  assert.ok(res.body.details.length > 0, `details must name at least one field: ${res.raw}`);
  for (const detail of res.body.details) {
    assert.ok(
      ["params", "query", "body"].includes(detail.location),
      `each detail must name the request section it came from: ${JSON.stringify(detail)}`
    );
    assert.equal(typeof detail.field, "string");
    assert.ok(detail.field.length > 0, `each detail must name the offending field: ${res.raw}`);
    assert.equal(typeof detail.message, "string");
    assert.ok(detail.message.length > 0, `each detail must carry a message: ${res.raw}`);
    assert.equal(typeof detail.type, "string");
    assert.ok(detail.type.length > 0, `each detail must carry a machine-readable type: ${res.raw}`);
  }
};

/**
 * Every declared route of a router, as `{ method, path, handles }`.
 */
const routesOf = (router) =>
  router.stack
    .filter((layer) => layer.route)
    .map((layer) => ({
      path: layer.route.path,
      method: Object.keys(layer.route.methods).join(",").toUpperCase(),
      handles: layer.route.stack.map((entry) => entry.handle),
    }));

const allRouters = () => [
  ["models", modelRouter],
  ["data-recorders", dataRecorderRouter],
  ["simulation", simulationRouter],
  ["logs", createLogRouter("simulations")],
  ["test-cases", testCasesRouter],
  ["test-campaigns", testCampaignRouter],
  ["data-sets", dataSetRouter],
  ["events", eventRouter],
  ["reports", reportRouter],
  ["data-storage", dataStorageRouter],
  ["devops", devopsRouter],
];

/**
 * Run a route's validation layer on its own, with no handler and no database
 * behind it. The database-backed routes cannot be driven to a 200 without a
 * MongoDB, but their schemas still have to accept the payloads the dashboard
 * sends — this is how that is asserted.
 */
const validateOnly = (router, method, routePath, req) => {
  const route = routesOf(router).find(
    (candidate) => candidate.path === routePath && candidate.method === method
  );
  assert.ok(route, `no ${method} ${routePath} route`);
  const layer = route.handles.find((handle) => handle.name === "validateRequest");
  assert.ok(layer, `${method} ${routePath} declares no schema`);

  return new Promise((resolve) => {
    const res = {
      statusCode: 200,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(payload) {
        resolve({ passed: false, status: this.statusCode, body: payload });
      },
    };
    const request_ = { params: {}, query: {}, body: {}, ...req };
    layer(request_, res, () => resolve({ passed: true, req: request_ }));
  });
};

// ---------------------------------------------------------------------------
// 1. Every endpoint declares a schema for its parameters, query string and body
// ---------------------------------------------------------------------------

test("every endpoint declares a schema", () => {
  const undeclared = [];
  for (const [name, router] of allRouters()) {
    for (const route of routesOf(router)) {
      const declares = route.handles.some((handle) => handle.name === "validateRequest");
      if (!declares) undeclared.push(`${route.method} /api/${name}${route.path}`);
    }
  }
  assert.deepEqual(undeclared, [], "these endpoints accept input with no declared schema");
});

test("the declared schema runs before anything else on the route", () => {
  // A schema that runs after a database connector or a handler is not a
  // validation layer — the rejected value has already been used by then.
  const late = [];
  for (const [name, router] of allRouters()) {
    for (const route of routesOf(router)) {
      if (route.handles[0].name !== "validateRequest") {
        late.push(`${route.method} /api/${name}${route.path}`);
      }
    }
  }
  assert.deepEqual(late, [], "these endpoints validate after other middleware has run");
});

test("app.js parses query strings without bracket notation", () => {
  // Read as source rather than by booting the app: requiring it binds the
  // static file middleware and the environment configuration for no benefit.
  const source = fs.readFileSync(path.resolve(__dirname, "../src/server/app.js"), "utf8");
  assert.match(
    source,
    /app\.set\(\s*["']query parser["']\s*,\s*["']simple["']\s*\)/,
    "the extended query parser is what turns ?a[$ne]=1 into an object"
  );
});

// ---------------------------------------------------------------------------
// 2. Values that do not match their declared type are rejected before reaching
//    any handler or database call
// ---------------------------------------------------------------------------

test("bodies with mistyped fields are rejected", async () => {
  const cases = [
    ["POST", "/api/models", { model: { name: 42, devices: [] } }],
    ["POST", "/api/models", { model: { name: "ok", devices: "not-an-array" } }],
    ["POST", "/api/data-recorders/models", { dataRecorder: { name: 42, dataRecorders: [] } }],
    ["POST", "/api/data-recorders/start", { dataRecorderFileName: 42 }],
    ["POST", "/api/simulation/start", { modelFileName: { $ne: null } }],
    ["POST", "/api/test-cases", { testCase: { id: "x", modelFileName: 42 } }],
    ["POST", "/api/test-campaigns", { testCampaign: { id: "x", testCaseIds: "not-an-array" } }],
    ["POST", "/api/data-sets", { dataset: { id: "x", name: 42 } }],
    ["POST", "/api/events", { event: { timestamp: "not-a-number", topic: "t", datasetId: "d" } }],
    ["POST", "/api/events", { event: { timestamp: 1, topic: { $ne: null }, datasetId: "d" } }],
    ["POST", "/api/reports/any-id", { report: { score: "not-a-number" } }],
    ["POST", "/api/data-storage", { dataStorage: { protocol: "REDIS", connConfig: { host: "h", port: 1 } } }],
    ["POST", "/api/data-storage", { dataStorage: { protocol: "MONGODB", connConfig: { host: "h", port: 99999 } } }],
    ["POST", "/api/devops", { devops: { testCampaignId: 42 } }],
  ];
  for (const [method, routePath, body] of cases) {
    const res = await request(server, method, routePath, body);
    assertValidationError(res, `${method} ${routePath} ${JSON.stringify(body)}`);
  }
});

test("required fields cannot be omitted", async () => {
  const cases = [
    ["POST", "/api/models", { model: { devices: [] } }],
    ["POST", "/api/data-recorders/models", { dataRecorder: { dataRecorders: [] } }],
    ["POST", "/api/data-sets", { dataset: { name: "no id" } }],
    ["POST", "/api/events", { event: { timestamp: 123 } }],
    ["POST", "/api/test-cases", { testCase: { name: "no id" } }],
    ["POST", "/api/test-campaigns", { testCampaign: { name: "no id" } }],
  ];
  for (const [method, routePath, body] of cases) {
    const res = await request(server, method, routePath, body);
    assertValidationError(res, `${method} ${routePath} ${JSON.stringify(body)}`);
  }
});

test("a request whose whole body is unrecognised is rejected", async () => {
  const routes = [
    ["POST", "/api/models"],
    ["POST", "/api/data-recorders/models"],
    ["POST", "/api/data-recorders/start"],
    ["POST", "/api/simulation/start"],
    ["POST", "/api/test-cases"],
    ["POST", "/api/test-campaigns"],
    ["POST", "/api/data-sets"],
    ["POST", "/api/events"],
    ["POST", "/api/data-storage"],
    ["POST", "/api/devops"],
  ];
  for (const [method, routePath] of routes) {
    const res = await request(server, method, routePath, { unexpected: true });
    assertValidationError(res, `${method} ${routePath}`);
  }
});

test("path parameters that cannot name a stored file are rejected", async () => {
  const routes = [
    ["GET", "/api/models/..%2Fpackage.json"],
    ["DELETE", "/api/models/..%2Fpackage.json"],
    ["POST", "/api/models/..%2Fbad.json"],
    ["GET", "/api/data-recorders/models/..%2Fpackage.json"],
    ["DELETE", "/api/data-recorders/models/..%2Fpackage.json"],
    ["GET", "/api/data-recorders/stop/..%2Fbad.json"],
    ["GET", "/api/simulation/stop/..%2Fbad.json"],
    ["GET", "/api/logs/simulations/..%2Fpackage.log"],
    ["DELETE", "/api/logs/simulations/..%2Fpackage.log"],
  ];
  for (const [method, routePath] of routes) {
    const res = await request(server, method, routePath);
    assertValidationError(res, `${method} ${routePath}`);
  }
});

test("MongoDB operator documents are rejected before reaching a database call", async () => {
  const cases = [
    ["POST", "/api/test-cases/any-id", { testCase: { $set: { modelFileName: "/etc/passwd" } } }],
    ["POST", "/api/test-cases/any-id", { testCase: { $unset: { modelFileName: "" } } }],
    ["POST", "/api/test-campaigns/any-id", { testCampaign: { $set: { name: "x" } } }],
    ["POST", "/api/data-sets/any-id", { dataset: { $set: { name: "x" } } }],
    ["POST", "/api/events/any-id", { event: { $set: { topic: "x" } } }],
    ["POST", "/api/reports/any-id", { report: { $set: { score: 1 } } }],
    ["POST", "/api/test-cases/any-id", { testCase: { "values.nested": 1 } }],
  ];
  for (const [method, routePath, body] of cases) {
    const res = await request(server, method, routePath, body);
    assertValidationError(res, `${method} ${routePath} ${JSON.stringify(body)}`);
  }
});

test("an empty test campaign id is rejected, as it was before the schemas", async () => {
  // The helper the schema replaced answered 400 for `""` (`isValidName`
  // required a non-empty name), and an empty id would interpolate into a log
  // file name as nothing at all. An absent id stays acceptable — that is
  // asserted separately in the route security suite.
  const before = fs.readFileSync(devopsFile, "utf8");
  const res = await request(server, "POST", "/api/devops", {
    devops: { webhookURL: "http://localhost:3333/webhook", testCampaignId: "" },
  });
  assertValidationError(res, "POST /api/devops with an empty testCampaignId");
  assert.equal(
    fs.readFileSync(devopsFile, "utf8"),
    before,
    "a rejected configuration must never be written to disk"
  );
});

// ---------------------------------------------------------------------------
// 3. Query parameters intended as strings cannot arrive as structured objects
// ---------------------------------------------------------------------------

test("query parameters declared as strings cannot arrive as objects", async () => {
  // Every one of these is `?name[$operator]=value`, which Express's default
  // parser hands to the handler as an object and which the handler copies
  // straight into a Mongo filter.
  const injections = [
    "/api/events?datasetId[$ne]=x",
    "/api/events?topic[$ne]=x",
    "/api/events?topic[$regex]=(a%2B)%2B%24",
    "/api/events?startTime[$gt]=0",
    "/api/events?endTime[$gt]=0",
    "/api/events?page[$gt]=0",
    "/api/reports?topologyFileName[$ne]=x",
    "/api/reports?testCampaignId[$ne]=x",
    "/api/data-sets?page[$gt]=0",
  ];
  for (const routePath of injections) {
    const res = await request(server, "GET", routePath);
    assertValidationError(res, `GET ${routePath}`);
  }
});

test("query parameters declared as strings cannot arrive as arrays", async () => {
  for (const routePath of ["/api/events?datasetId=a&datasetId=b", "/api/reports?testCampaignId=a&testCampaignId=b"]) {
    const res = await request(server, "GET", routePath);
    assertValidationError(res, `GET ${routePath}`);
  }
});

test("query parameters no endpoint declares never reach the handler", async () => {
  const passed = await validateOnly(dataSetRouter, "GET", "/", {
    query: { page: "2", smuggled: { $ne: null } },
  });
  assert.equal(passed.passed, true, "a declared page must still be accepted");
  assert.deepEqual(
    passed.req.query,
    { page: 2 },
    "an undeclared query parameter must be stripped, not passed on"
  );
});

// ---------------------------------------------------------------------------
// 4. Validation failures return a consistent, machine-readable error shape that
//    names the offending field
// ---------------------------------------------------------------------------

test("a validation failure names the offending field and where it came from", async () => {
  const res = await request(server, "POST", "/api/models", {
    model: { name: 42, devices: [] },
  });
  assertValidationError(res, "POST /api/models");
  const [detail] = res.body.details;
  assert.equal(detail.location, "body");
  assert.equal(detail.field, "model.name");
  assert.equal(detail.type, "string.base");
});

test("a query failure is reported against the query string", async () => {
  const res = await request(server, "GET", "/api/events?datasetId[$ne]=x");
  assertValidationError(res, "GET /api/events");
  const [detail] = res.body.details;
  assert.equal(detail.location, "query");
  assert.equal(detail.field, "datasetId");
});

test("a parameter failure is reported against the path parameter", async () => {
  const res = await request(server, "GET", "/api/models/..%2Fpackage.json");
  assertValidationError(res, "GET /api/models/..");
  const [detail] = res.body.details;
  assert.equal(detail.location, "params");
  assert.equal(detail.field, "fileName");
});

test("every offending field is reported, not just the first", async () => {
  const res = await request(server, "POST", "/api/models", {
    model: { name: 42, devices: "not-an-array" },
  });
  assertValidationError(res, "POST /api/models");
  const fields = res.body.details.map((detail) => detail.field).sort();
  assert.deepEqual(fields, ["model.devices", "model.name"]);
});

test("validation failures disclose nothing about the server", async () => {
  const res = await request(server, "GET", "/api/models/..%2F..%2Fetc%2Fpasswd.json");
  assert.equal(res.status, 400);
  assert.ok(!res.raw.includes("/home/"), `must not leak server paths: ${res.raw}`);
  assert.ok(!res.raw.includes("workspace"), `must not leak server paths: ${res.raw}`);
});

// ---------------------------------------------------------------------------
// 5. The declared schemas are the single source of truth
// ---------------------------------------------------------------------------

test("handlers read the value the schema produced, not the raw one", async () => {
  const outcome = await validateOnly(eventRouter, "GET", "/", {
    query: { page: "3", startTime: "10", endTime: "20" },
  });
  assert.equal(outcome.passed, true);
  assert.deepEqual(
    outcome.req.query,
    { page: 3, startTime: 10, endTime: 20 },
    "declared numbers must reach the handler as numbers"
  );
});

test("an endpoint that declares no input accepts none", async () => {
  const outcome = await validateOnly(modelRouter, "GET", "/", {
    query: { smuggled: "x" },
  });
  assert.equal(outcome.passed, true);
  assert.deepEqual(outcome.req.query, {});
});

// ---------------------------------------------------------------------------
// 6. Existing valid dashboard requests continue to succeed unchanged
// ---------------------------------------------------------------------------

test("the model lifecycle the dashboard drives still succeeds", async () => {
  const name = unique("iv-model");
  const create = await request(server, "POST", "/api/models", {
    model: { name, devices: [{ type: "sensor", name: "temp" }] },
  });
  assert.equal(create.status, 200, `create must succeed (${create.raw})`);
  const fileName = create.body.modelFileName;
  try {
    const read = await request(server, "GET", `/api/models/${encodeURIComponent(fileName)}`);
    assert.equal(read.status, 200, read.raw);
    assert.equal(read.body.model.name, name);

    // The duplicate button sends no model of its own; requiring one here would
    // break it.
    const duplicate = await request(server, "POST", `/api/models/${encodeURIComponent(fileName)}`, {
      isDuplicated: true,
    });
    assert.equal(duplicate.status, 200, `duplicate must succeed (${duplicate.raw})`);
    await request(
      server,
      "DELETE",
      `/api/models/${encodeURIComponent(duplicate.body.modelFileName)}`
    );

    const list = await request(server, "GET", "/api/models");
    assert.equal(list.status, 200, list.raw);
    assert.ok(Array.isArray(list.body.models));
  } finally {
    await request(server, "DELETE", `/api/models/${encodeURIComponent(fileName)}`);
    assert.ok(!fs.existsSync(path.join(modelsDir, fileName)), "test must leave no model behind");
  }
});

test("a model whose name is at the length limit round-trips through its own routes", async () => {
  // The write path caps the *name* and the read paths cap the *file name* that
  // write derived from it, so a name at exactly the limit is where the two
  // disagree if they are ever counted against the same number: the file would
  // be written and then no route could read, update or delete it.
  const name = unique("iv-boundary").padEnd(NAME_MAX_LENGTH, "x");
  assert.equal(name.length, NAME_MAX_LENGTH, "the test must exercise the limit itself");
  const fileName = `${name}.json`;
  const filePath = path.join(modelsDir, fileName);

  const create = await request(server, "POST", "/api/models", {
    model: { name, devices: [] },
  });
  assert.equal(create.status, 200, `a name at the limit must be accepted (${create.raw})`);
  assert.equal(create.body.modelFileName, fileName);

  try {
    const read = await request(server, "GET", `/api/models/${encodeURIComponent(fileName)}`);
    assert.equal(read.status, 200, `the file the write produced must be readable (${read.raw})`);
    assert.equal(read.body.model.name, name);

    const removed = await request(
      server,
      "DELETE",
      `/api/models/${encodeURIComponent(fileName)}`
    );
    assert.equal(removed.status, 200, `the file must be deletable (${removed.raw})`);
    assert.ok(!fs.existsSync(filePath), "the delete must actually remove the file");
  } finally {
    // Only reached when an assertion above failed before the delete ran; the
    // checkout must not keep the file either way.
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
});

test("the data recorder lifecycle the dashboard drives still succeeds", async () => {
  const name = unique("iv-recorder");
  const create = await request(server, "POST", "/api/data-recorders/models", {
    dataRecorder: { name, dataRecorders: [{ type: "logger", name: "log1" }] },
  });
  assert.equal(create.status, 200, `create must succeed (${create.raw})`);
  const fileName = create.body.dataRecorderFileName;
  try {
    const read = await request(
      server,
      "GET",
      `/api/data-recorders/models/${encodeURIComponent(fileName)}`
    );
    assert.equal(read.status, 200, read.raw);

    const duplicate = await request(
      server,
      "POST",
      `/api/data-recorders/models/${encodeURIComponent(fileName)}`,
      { isDuplicated: true }
    );
    assert.equal(duplicate.status, 200, `duplicate must succeed (${duplicate.raw})`);
    await request(
      server,
      "DELETE",
      `/api/data-recorders/models/${encodeURIComponent(duplicate.body.dataRecorderFileName)}`
    );
  } finally {
    await request(
      server,
      "DELETE",
      `/api/data-recorders/models/${encodeURIComponent(fileName)}`
    );
    assert.ok(
      !fs.existsSync(path.join(dataRecordersDir, fileName)),
      "test must leave no data recorder behind"
    );
  }
});

test("the shipped models and log listings still serve unchanged", async () => {
  const model = await request(server, "GET", "/api/models/202402-Temperature-Controller.json");
  assert.equal(model.status, 200, model.raw);
  assert.equal(model.body.model.name, "Temperature-Controller");

  const recorder = await request(
    server,
    "GET",
    "/api/data-recorders/models/TemperatureControllerRecorder.json"
  );
  assert.equal(recorder.status, 200, recorder.raw);

  const logs = await request(server, "GET", "/api/logs/simulations");
  assert.equal(logs.status, 200, logs.raw);
  assert.ok(Array.isArray(logs.body.files));

  const status = await request(server, "GET", "/api/simulation/status");
  assert.equal(status.status, 200, status.raw);
});

test("the shipped devops configuration still round-trips through its schema", async () => {
  const devops = JSON.parse(originalDevops);
  const res = await request(server, "POST", "/api/devops", { devops });
  assert.equal(res.status, 200, `the shipped configuration must be accepted (${res.raw})`);
  assert.deepEqual(JSON.parse(fs.readFileSync(devopsFile, "utf8")), devops);
});

test("the shipped data storage configuration still satisfies its schema", async () => {
  // Driving POST /api/data-storage to a 200 would rewrite the checkout's
  // configuration and open a database connection, so only the schema runs.
  const dataStorage = JSON.parse(fs.readFileSync(dataStorageFile, "utf8"));
  const outcome = await validateOnly(dataStorageRouter, "POST", "/", { body: { dataStorage } });
  assert.equal(
    outcome.passed,
    true,
    `the persisted configuration must satisfy the schema it is posted against: ${JSON.stringify(
      outcome.body
    )}`
  );
});

test("the database-backed payloads the dashboard sends still satisfy their schemas", async () => {
  const persisted = { _id: "6512f0a1c2d3e4f5a6b7c8d9", __v: 0, createdAt: 1, lastModified: 2 };
  const cases = [
    [
      testCasesRouter,
      "POST",
      "/",
      { body: { testCase: { id: "tc-1", name: "A test case", tags: ["a"], datasetIds: ["d1"], modelFileName: "202402-Temperature-Controller.json", ...persisted } } },
    ],
    [
      testCasesRouter,
      "POST",
      "/:testCaseId",
      { params: { testCaseId: "tc-1" }, body: { testCase: { name: "Renamed", ...persisted } } },
    ],
    [
      testCampaignRouter,
      "POST",
      "/",
      { body: { testCampaign: { id: "tcp-1", name: "A campaign", testCaseIds: ["tc-1"], webhookURL: "http://localhost:3333/webhook", ...persisted } } },
    ],
    [
      dataSetRouter,
      "POST",
      "/",
      { body: { dataset: { id: "ds-1", name: "A data set", tags: [], source: "RECORDED", ...persisted } } },
    ],
    [
      eventRouter,
      "POST",
      "/",
      { body: { event: { timestamp: 1591971273868, topic: "enact/sensors/temp-03", datasetId: "ds-1", isSensorData: true, values: { temp: 20 }, ...persisted } } },
    ],
    [
      reportRouter,
      "POST",
      "/:reportId",
      { params: { reportId: "r-1" }, body: { report: { id: "r-1", score: 0.5, createdAt: 1, startTime: 1, endTime: 2, newDatasetId: "ds-2" }, newScore: true } },
    ],
    [eventRouter, "GET", "/", { query: { datasetId: "ds-1", startTime: "0", endTime: "9999999999", page: "0" } }],
    [reportRouter, "GET", "/", { query: { topologyFileName: "202402-Temperature-Controller.json", testCampaignId: "tcp-1" } }],
    [dataSetRouter, "GET", "/", { query: { page: "0" } }],
  ];

  for (const [router, method, routePath, req] of cases) {
    const outcome = await validateOnly(router, method, routePath, req);
    assert.equal(
      outcome.passed,
      true,
      `${method} ${routePath} must accept the dashboard's payload: ${JSON.stringify(outcome.body)}`
    );
  }
});

// ---------------------------------------------------------------------------
// 7. A run's configuration cannot reach a MongoDB filter, or point the run at
//    a database of the caller's choosing
// ---------------------------------------------------------------------------

// `POST /api/simulation/start` is never driven to a 200 here: that would
// actually start a simulation, open a database connection and write log files.
// Only the schema runs, which is where these are decided anyway.
const startRun = (body) => validateOnly(simulationRouter, "POST", "/start", { body });

/**
 * Assert a body was refused with the standard failure shape, and name the field
 * the refusal has to be about.
 */
const assertBodyRejected = async (router, method, routePath, body, field, context) => {
  const outcome = await validateOnly(router, method, routePath, { body });
  assert.equal(outcome.passed, false, `${context} must be rejected`);
  assertValidationError(
    { status: outcome.status, body: outcome.body, raw: JSON.stringify(outcome.body) },
    context
  );
  assert.ok(
    outcome.body.details.some((detail) => detail.field === field),
    `${context} must be reported against ${field}: ${JSON.stringify(outcome.body.details)}`
  );
};

const assertBodyAccepted = async (router, method, routePath, body, context) => {
  const outcome = await validateOnly(router, method, routePath, { body });
  assert.equal(
    outcome.passed,
    true,
    `${context} must still be accepted: ${JSON.stringify(outcome.body)}`
  );
  return outcome;
};

const assertRunRejected = (body, field, context) =>
  assertBodyRejected(simulationRouter, "POST", "/start", body, field, context);

const assertRunAccepted = (body, context) =>
  assertBodyAccepted(simulationRouter, "POST", "/start", body, context);

test("the payload the dashboard starts a simulation with is still accepted", async () => {
  // `src/client/src/api/index.js` sends exactly this, and `SimulationPage`
  // sends a null datasetId when no data source is selected.
  for (const datasetId of ["dataset-2024-03", null]) {
    await assertRunAccepted(
      {
        modelFileName: "202402-Temperature-Controller.json",
        options: {
          datasetId,
          newDataset: {
            id: `dataset-id-${Date.now()}`,
            name: `Dataset has been created at ${Date.now()}`,
            description: `This is the description of the dataset`,
            tags: ["generated"],
            source: "GENERATED",
          },
        },
      },
      `the dashboard payload with datasetId ${JSON.stringify(datasetId)}`
    );
  }
});

test("starting a run with no options of its own is still accepted", async () => {
  // `ModelListPage` dispatches with the file name only, so the datasetId and
  // newDataset it does not set are dropped by JSON.stringify and an empty
  // options object arrives.
  await assertRunAccepted(
    { modelFileName: "202402-Temperature-Controller.json", options: {} },
    "a start request carrying an empty options object"
  );
});

test("a run that sends no options at all still reaches the handler with an object", async () => {
  // The handler dereferences `options` inside the readJSONFile callback, so an
  // undefined there throws asynchronously and takes the process down rather
  // than failing the one request. The schema is what guarantees it cannot be
  // undefined, so that guarantee is asserted on the validated body itself.
  const outcome = await assertRunAccepted(
    { modelFileName: "202402-Temperature-Controller.json" },
    "a start request that omits options entirely"
  );
  assert.equal(
    typeof outcome.req.body.options,
    "object",
    "the handler must never be handed an undefined options"
  );
  assert.ok(outcome.req.body.options !== null, "nor a null one");
  assert.deepEqual(outcome.req.body.options, {});
});

test("the shipped topology is still accepted as an inline model", async () => {
  const model = JSON.parse(
    fs.readFileSync(path.join(modelsDir, "202402-Temperature-Controller.json"), "utf8")
  );
  await assertRunAccepted({ model }, "the shipped topology posted inline");
});

test("a run's dataset id cannot arrive as a structured value", async () => {
  // It becomes the filter `EventSchema.findEventsBetweenTimes` reads the
  // original events with, so a structured value changes which events the run
  // is scored against rather than naming one dataset.
  for (const datasetId of [{ $ne: null }, { $gt: "" }, ["ds-1"], 42]) {
    await assertRunRejected(
      { modelFileName: "m.json", options: { datasetId } },
      "options.datasetId",
      `options.datasetId as ${JSON.stringify(datasetId)}`
    );
  }
  // The generated dataset's id reaches a filter of its own.
  await assertRunRejected(
    { modelFileName: "m.json", options: { newDataset: { id: { $ne: null } } } },
    "options.newDataset.id",
    "options.newDataset.id as an operator document"
  );
});

test("a run cannot point its database connection at a host of its choosing", async () => {
  // `options.dataStorage` becomes the connection every device of the run
  // publishes through, so an unconstrained one redirects the whole run.
  const hostile = [
    "evil.example.com/tas?replicaSet=x",
    "evil.example.com:27017,other.example.com",
    "a".repeat(300),
    "evil example",
  ];
  for (const host of hostile) {
    await assertRunRejected(
      {
        modelFileName: "m.json",
        options: { dataStorage: { protocol: "MONGODB", connConfig: { host, port: 27017 } } },
      },
      "options.dataStorage.connConfig.host",
      `options.dataStorage host ${JSON.stringify(host.slice(0, 40))}`
    );
  }
  await assertRunRejected(
    {
      modelFileName: "m.json",
      options: {
        dataStorage: { protocol: "HTTP", connConfig: { host: "localhost", port: 27017 } },
      },
    },
    "options.dataStorage.protocol",
    "a data storage protocol the connector cannot speak"
  );
  // A well-formed connection is still allowed: the point is the shape, not the
  // ability to override.
  await assertRunAccepted(
    {
      modelFileName: "m.json",
      options: {
        dataStorage: {
          protocol: "MONGODB",
          connConfig: { host: "localhost", port: 27017, dbname: "tas", username: "", password: "" },
        },
      },
    },
    "a well-formed data storage override"
  );
});

test("options no run declares never reach the simulation", async () => {
  await assertRunRejected(
    { modelFileName: "m.json", options: { $ne: null } },
    "options.$ne",
    "an operator key smuggled in as an option"
  );
});

test("the same fields are constrained when they arrive on an inline model", async () => {
  // `Simulation` reads these off the model first and only then lets options
  // overwrite them, so the model reaches the identical sinks. The model stays
  // open to the other fields a stored topology carries.
  await assertRunRejected(
    { model: { name: "iv-inline", devices: [], datasetId: { $ne: null } } },
    "model.datasetId",
    "an inline model's datasetId as an operator document"
  );
  await assertRunRejected(
    {
      model: {
        name: "iv-inline",
        devices: [],
        dataStorage: { protocol: "MONGODB", connConfig: { host: "evil.example.com/x", port: 1 } },
      },
    },
    "model.dataStorage.connConfig.host",
    "an inline model's dataStorage host"
  );
  await assertRunAccepted(
    { model: { name: "iv-inline", devices: [], somethingElseEntirely: { nested: true } } },
    "an inline model carrying a field the schema does not declare"
  );
});

// ---------------------------------------------------------------------------
// 8. The other endpoints that accept a database connection are held to the
//    same shape as the one that persists it
// ---------------------------------------------------------------------------

// A recorder writes every event it records into the connection its document
// carries, and the devops configuration is read back and handed to the test
// campaign flow, which builds one from it. Both reach the same
// `mongodb://${host}:${port}` builder as `POST /api/data-storage`.
const hostileConnConfigs = [
  { host: "evil.example.com/tas?replicaSet=x", port: 27017 },
  { host: "evil.example.com:27017,other.example.com", port: 27017 },
  { host: "a".repeat(300), port: 27017 },
];

// The connection the dashboard builds in `DataRecorderPage.addCustomDataStorage`.
const dashboardDataStorage = {
  protocol: "MONGODB",
  connConfig: {
    host: "localhost",
    port: 27017,
    username: null,
    password: null,
    dbname: "my_db_name",
    options: null,
  },
};

test("a data recorder cannot point its database connection at a host of its choosing", async () => {
  for (const connConfig of hostileConnConfigs) {
    await assertBodyRejected(
      dataRecorderRouter,
      "POST",
      "/start",
      { model: { name: "iv-recorder", dataRecorders: [], dataStorage: { protocol: "MONGODB", connConfig } } },
      "model.dataStorage.connConfig.host",
      `a recorder started with host ${JSON.stringify(connConfig.host.slice(0, 40))}`
    );
    // The same document is what `POST /models` persists, so it is checked there too.
    await assertBodyRejected(
      dataRecorderRouter,
      "POST",
      "/models",
      { dataRecorder: { name: "iv-recorder", dataRecorders: [], dataStorage: { protocol: "MONGODB", connConfig } } },
      "dataRecorder.dataStorage.connConfig.host",
      `a recorder stored with host ${JSON.stringify(connConfig.host.slice(0, 40))}`
    );
  }
});

test("a data recorder's dataset id cannot arrive as a structured value", async () => {
  // It becomes the filter `saveDataset` looks the dataset up with.
  await assertBodyRejected(
    dataRecorderRouter,
    "POST",
    "/start",
    { model: { name: "iv-recorder", dataRecorders: [], dataset: { id: { $ne: null } } } },
    "model.dataset.id",
    "a recorder dataset id as an operator document"
  );
});

test("the shipped data recorder still satisfies its schema", async () => {
  const recorder = JSON.parse(
    fs.readFileSync(path.join(dataRecordersDir, "TemperatureControllerRecorder.json"), "utf8")
  );
  await assertBodyAccepted(
    dataRecorderRouter,
    "POST",
    "/models",
    { dataRecorder: recorder },
    "the shipped recorder document"
  );
  await assertBodyAccepted(
    dataRecorderRouter,
    "POST",
    "/start",
    { model: recorder },
    "the shipped recorder started inline"
  );
  await assertBodyAccepted(
    dataRecorderRouter,
    "POST",
    "/models",
    {
      dataRecorder: {
        name: "iv-recorder",
        dataRecorders: [],
        dataStorage: dashboardDataStorage,
        dataset: { id: "new-data-set-id-1", name: "n", description: "d", tags: ["generated"] },
      },
    },
    "a recorder carrying the connection the dashboard builds"
  );
});

test("the devops configuration cannot carry a database connection of any shape", async () => {
  for (const connConfig of hostileConnConfigs) {
    const before = fs.readFileSync(devopsFile, "utf8");
    const res = await request(server, "POST", "/api/devops", {
      devops: {
        webhookURL: "http://localhost:3333/webhook",
        testCampaignId: "iv-campaign",
        dataStorage: { protocol: "MONGODB", connConfig },
      },
    });
    assertValidationError(res, `POST /api/devops with host ${JSON.stringify(connConfig.host.slice(0, 40))}`);
    assert.ok(
      res.body.details.some((detail) => detail.field === "devops.dataStorage.connConfig.host"),
      `the refusal must name the host: ${res.raw}`
    );
    assert.equal(
      fs.readFileSync(devopsFile, "utf8"),
      before,
      "a rejected configuration must never be written to disk"
    );
  }
});

test("a well-formed devops database connection is still accepted", async () => {
  const before = fs.readFileSync(devopsFile, "utf8");
  try {
    const res = await request(server, "POST", "/api/devops", {
      devops: {
        webhookURL: "http://localhost:3333/webhook",
        testCampaignId: "iv-campaign",
        dataStorage: dashboardDataStorage,
      },
    });
    assert.equal(res.status, 200, `a well-formed connection must be accepted (${res.raw})`);
  } finally {
    fs.writeFileSync(devopsFile, before);
  }
});
