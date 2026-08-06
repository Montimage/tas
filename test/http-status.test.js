/**
 * HTTP status semantics and error disclosure (issue #11).
 *
 * The API used to answer 200 for everything and signal failure only with an
 * `error` field, so a client, a proxy or a monitor could not tell a served
 * request from a failed one without parsing the body — and some failures
 * carried the raw underlying error, which discloses absolute server paths.
 *
 * These tests pin the four properties that fixes that: conventional status
 * codes, one error shape from one central handler, nothing internal in the
 * body, and the full detail still in the log.
 */
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const express = require("express");
const { request } = require("./_http");
const { startApp } = require("./helpers/start-app");

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
const {
  ApiError,
  badRequest,
  forbidden,
  notFound,
  conflict,
  unavailable,
  internal,
  databaseError,
  fileError,
  errorHandler,
  INTERNAL_MESSAGE,
} = require("../src/server/middleware/errors");

const devopsFile = path.resolve(__dirname, "../src/server/data/devops.json");
const simulationLogsDir = path.resolve(__dirname, "../src/server/logs/simulations");
const recorderLogsDir = path.resolve(__dirname, "../src/server/logs/data-recorders");

let server;
let app;
let originalDevops;

before(() => {
  // One test below makes the devops configuration unreadable on purpose.
  originalDevops = fs.readFileSync(devopsFile, "utf8");
  // Nothing under src/server/logs is tracked, so on a fresh checkout the
  // directory does not exist and a missing *file* would be indistinguishable
  // from a missing directory.
  fs.mkdirSync(simulationLogsDir, { recursive: true });
  fs.mkdirSync(recorderLogsDir, { recursive: true });

  app = express();
  app.use(express.json());
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
 * Remove the run log a start leaves behind.
 *
 * Every start opens `<name>_<timestamp>.log` through `getLogger`, and nothing in
 * the server ever removes it, so a test that starts something has to take its
 * own files away again.
 */
const removeRunLogs = (dir, name) => {
  let entries;
  try {
    entries = fs.readdirSync(dir);
  } catch (e) {
    return;
  }
  for (const entry of entries) {
    if (entry.startsWith(`${name}_`)) fs.unlinkSync(path.join(dir, entry));
  }
};

/**
 * Text that must never appear in a response body: this checkout's own location
 * (derived, so the check still means something wherever CI puts it), the shape
 * of a raw fs error, and the shape of a stack trace.
 */
const repoRoot = path.resolve(__dirname, "..");
const DISCLOSURES = [
  repoRoot,
  path.dirname(repoRoot),
  "ENOENT",
  "no such file",
  "at Object.",
  "at Function.",
  "node_modules",
  "node:internal",
];

/**
 * Assert an error response is the one shape the API has, and that it carries
 * nothing but that shape.
 */
const assertErrorShape = (res, status, context) => {
  assert.equal(res.status, status, `expected ${status} for ${context}, got ${res.status} (${res.raw})`);
  assert.ok(res.body, `${context} must answer with a JSON body (${res.raw})`);
  assert.equal(typeof res.body.error, "string", `${context} must carry a string error (${res.raw})`);
  assert.ok(res.body.error.length > 0, `${context} must carry a message (${res.raw})`);
  assert.deepEqual(
    Object.keys(res.body).filter((key) => key !== "error" && key !== "details"),
    [],
    `an error body carries nothing but error and details: ${res.raw}`
  );
  for (const disclosure of DISCLOSURES) {
    assert.ok(
      !res.raw.includes(disclosure),
      `${context} must not disclose ${disclosure}: ${res.raw}`
    );
  }
};

// ---------------------------------------------------------------------------
// 1. One central handler, one shape, one status per kind of failure
// ---------------------------------------------------------------------------

/**
 * A probe application whose only job is to hand a failure to `next`, so the
 * handler's own behaviour is asserted rather than inferred from a route that
 * happens to reach it.
 */
const probeApp = () => {
  const probe = express();
  probe.use(express.json());
  probe.get("/bad-request", (req, res, next) => next(badRequest("Invalid request")));
  probe.get("/bad-request-details", (req, res, next) =>
    next(badRequest("Validation failed", [{ location: "body", field: "a", message: "m", type: "t" }]))
  );
  probe.get("/forbidden", (req, res, next) => next(forbidden("Origin not allowed")));
  probe.get("/not-found", (req, res, next) => next(notFound("Model not found")));
  probe.get("/conflict", (req, res, next) => next(conflict("Already running")));
  probe.get("/unavailable", (req, res, next) => next(unavailable("Database is unavailable")));
  probe.get("/internal", (req, res, next) => next(internal("Cannot save the new configuration")));
  // An error nobody classified, carrying exactly the kind of detail a raw fs
  // error carries.
  probe.get("/unclassified", (req, res, next) => {
    const err = new Error("ENOENT: no such file or directory, open '/home/secret/data/devops.json'");
    err.code = "ENOENT";
    err.path = "/home/secret/data/devops.json";
    next(err);
  });
  probe.get("/thrown", () => {
    throw new Error("boom at /home/secret/src/server/routes/model.js");
  });
  // Failures that arrive already carrying a status, the way Express's router
  // and anything built on `http-errors` report one.
  probe.get("/carries-400", (req, res, next) =>
    next(
      Object.assign(new URIError("Failed to decode param '%zz' at /home/secret/x"), {
        status: 400,
      })
    )
  );
  probe.get("/carries-415", (req, res, next) =>
    next(Object.assign(new Error("unsupported at /home/secret/x"), { statusCode: 415 }))
  );
  probe.get("/carries-503", (req, res, next) =>
    next(Object.assign(new Error("upstream down at /home/secret/x"), { status: 503 }))
  );
  probe.get("/carries-nonsense", (req, res, next) =>
    next(Object.assign(new Error("nonsense at /home/secret/x"), { status: "400" }))
  );
  probe.use(errorHandler);
  return probe;
};

test("each kind of failure answers with its conventional status code", async () => {
  const probe = probeApp().listen(0);
  try {
    const cases = [
      ["/bad-request", 400],
      ["/forbidden", 403],
      ["/not-found", 404],
      ["/conflict", 409],
      ["/unavailable", 503],
      ["/internal", 500],
    ];
    for (const [routePath, status] of cases) {
      const res = await request(probe, "GET", routePath);
      assertErrorShape(res, status, `GET ${routePath}`);
    }
  } finally {
    probe.close();
  }
});

test("a validation failure keeps its machine-readable details, and nothing else does", async () => {
  const probe = probeApp().listen(0);
  try {
    const withDetails = await request(probe, "GET", "/bad-request-details");
    assertErrorShape(withDetails, 400, "a failure carrying details");
    assert.equal(withDetails.body.error, "Validation failed");
    assert.deepEqual(withDetails.body.details, [
      { location: "body", field: "a", message: "m", type: "t" },
    ]);

    const withoutDetails = await request(probe, "GET", "/not-found");
    assert.equal(
      "details" in withoutDetails.body,
      false,
      `a failure with no per-field detail must not invent one: ${withoutDetails.raw}`
    );
  } finally {
    probe.close();
  }
});

test("an unclassified failure is reported as a bare 500 that discloses nothing", async () => {
  const probe = probeApp().listen(0);
  try {
    for (const routePath of ["/unclassified", "/thrown"]) {
      const res = await request(probe, "GET", routePath);
      assertErrorShape(res, 500, `GET ${routePath}`);
      assert.equal(
        res.body.error,
        INTERNAL_MESSAGE,
        `an unclassified failure must not echo its own message: ${res.raw}`
      );
      assert.ok(!res.raw.includes("secret"), `must not echo the underlying error: ${res.raw}`);
    }
  } finally {
    probe.close();
  }
});

test("a failure that already carries a 4xx keeps it, with a message of ours", async () => {
  // The status is the only thing an unclassified failure is trusted about, and
  // only when it is a 4xx: reporting a caller's mistake as a server fault is
  // what makes a monitor alert on client garbage. Everything else - the message
  // above all, which is where the internals are named - is still ours to choose.
  const probe = probeApp().listen(0);
  try {
    const kept = [
      ["/carries-400", 400, "Bad request"],
      ["/carries-415", 415, "Unsupported media type"],
    ];
    for (const [routePath, status, message] of kept) {
      const res = await request(probe, "GET", routePath);
      assertErrorShape(res, status, `GET ${routePath}`);
      assert.equal(res.body.error, message, `GET ${routePath} must not echo its own message`);
      assert.ok(!res.raw.includes("secret"), `must not echo the underlying error: ${res.raw}`);
    }
    // A 5xx a library chose says no more than the bare 500 already does, and a
    // status that is not an integer in the 4xx range is not a classification.
    for (const routePath of ["/carries-503", "/carries-nonsense"]) {
      const res = await request(probe, "GET", routePath);
      assertErrorShape(res, 500, `GET ${routePath}`);
      assert.equal(
        res.body.error,
        INTERNAL_MESSAGE,
        `only a 4xx may be taken from an unclassified failure: ${res.raw}`
      );
    }
  } finally {
    probe.close();
  }
});

test("a path whose percent-encoding cannot be decoded answers 400, not 500", async () => {
  // Express's router raises a `URIError` carrying `status: 400` when a path
  // segment cannot be decoded. It never reaches a route, so the shared handler
  // is the only thing that can answer it - and what the caller sent is
  // unambiguously the caller's fault.
  for (const routePath of [
    "/api/models/%E0%A4%A",
    "/api/models/%",
    "/api/models/%zz.json",
  ]) {
    const res = await request(server, "GET", routePath);
    assertErrorShape(res, 400, `GET ${routePath}`);
  }
});

test("every router renders its failures through the shared handler", async () => {
  // A router mounted on its own - which is how these suites mount them, and
  // how a future host might - must not fall through to Express's default error
  // handler, which answers with an HTML stack trace.
  const routers = [
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
  const missing = [];
  for (const [name, router] of routers) {
    // Last, not merely present: Express resumes error dispatch at the layer the
    // failure came from, so a handler registered ahead of a route would be
    // skipped for exactly the failures it exists to catch.
    const last = router.stack[router.stack.length - 1];
    const attached =
      last && !last.route && last.handle && last.handle.name === "errorHandler";
    if (!attached) missing.push(name);
  }
  assert.deepEqual(
    missing,
    [],
    "these routers do not end with the shared error handler"
  );
});

// ---------------------------------------------------------------------------
// 2. Missing resources answer 404 rather than 200 with an error field
// ---------------------------------------------------------------------------

test("reading a model that does not exist answers 404", async () => {
  const res = await request(server, "GET", `/api/models/${unique("absent")}.json`);
  assertErrorShape(res, 404, "GET a model that does not exist");
  assert.equal(res.body.error, "Model not found");
});

test("deleting a model that does not exist answers 404", async () => {
  const res = await request(server, "DELETE", `/api/models/${unique("absent")}.json`);
  assertErrorShape(res, 404, "DELETE a model that does not exist");
});

test("reading a data recorder that does not exist answers 404", async () => {
  const res = await request(
    server,
    "GET",
    `/api/data-recorders/models/${unique("absent")}.json`
  );
  assertErrorShape(res, 404, "GET a data recorder that does not exist");
  assert.equal(res.body.error, "Data recorder not found");
});

test("reading and deleting a log that does not exist answers 404", async () => {
  const fileName = `${unique("absent")}_${Date.now()}.log`;
  const read = await request(server, "GET", `/api/logs/simulations/${fileName}`);
  assertErrorShape(read, 404, "GET a log that does not exist");
  assert.equal(read.body.error, "Log file not found");

  const removed = await request(server, "DELETE", `/api/logs/simulations/${fileName}`);
  assertErrorShape(removed, 404, "DELETE a log that does not exist");
});

test("starting a simulation from a model that does not exist answers 404", async () => {
  const res = await request(server, "POST", "/api/simulation/start", {
    modelFileName: `${unique("absent")}.json`,
  });
  assertErrorShape(res, 404, "POST /api/simulation/start with an absent model");
});

test("starting a data recorder that does not exist answers 404", async () => {
  const res = await request(server, "POST", "/api/data-recorders/start", {
    dataRecorderFileName: `${unique("absent")}.json`,
  });
  assertErrorShape(res, 404, "POST /api/data-recorders/start with an absent recorder");
});

// ---------------------------------------------------------------------------
// 3. Validation failures keep their 400 and their shape, through the handler
// ---------------------------------------------------------------------------

test("a validation failure is still a 400 carrying the fields it refused", async () => {
  const res = await request(server, "POST", "/api/models", {
    model: { name: 42, devices: [] },
  });
  assertErrorShape(res, 400, "POST /api/models with a mistyped name");
  assert.equal(res.body.error, "Validation failed");
  assert.equal(res.body.details[0].field, "model.name");
});

test("an event that the database would refuse is refused with a 400 naming the field", async () => {
  // `EventSchema` declares `values` and `isSensorData` required, so a create
  // that omits either used to be accepted, fail at the save, and be reported as
  // 200 with "Failed to save the event" - a rejected write behind a success
  // status, which is exactly what this issue is about.
  const base = {
    timestamp: 1591971273868,
    topic: "enact/sensors/temp-03",
    datasetId: "ds-1",
    isSensorData: true,
    values: { temp: 20 },
  };
  const omissions = [
    ["values", "event.values"],
    ["isSensorData", "event.isSensorData"],
  ];
  for (const [omitted, field] of omissions) {
    const event = { ...base };
    delete event[omitted];
    const res = await request(server, "POST", "/api/events", { event });
    assertErrorShape(res, 400, `POST /api/events without ${omitted}`);
    assert.equal(res.body.error, "Validation failed");
    assert.ok(
      res.body.details.some((detail) => detail.field === field),
      `the refusal must name ${field}: ${res.raw}`
    );
  }
});

test("a database failure the schemas cannot express maps onto its own status", async () => {
  // The backstop for a constraint only the database knows about: a rejected
  // document is the caller's fault (400) and a duplicate key is a conflict
  // (409), neither of which may be reported as a success or as a 500.
  const cast = Object.assign(new Error("Cast to ObjectId failed"), { name: "CastError" });
  assert.equal(databaseError(cast, "Failed to get event").status, 400);
  const invalid = Object.assign(new Error("validation failed"), { name: "ValidationError" });
  assert.equal(databaseError(invalid, "Failed to save the event").status, 400);
  const duplicate = Object.assign(new Error("E11000 duplicate key"), { code: 11000 });
  assert.equal(databaseError(duplicate, "Failed to save the event").status, 409);
  const unknown = new Error("connection reset");
  const mapped = databaseError(unknown, "Failed to save the event");
  assert.equal(mapped.status, 500);
  assert.equal(mapped.message, "Failed to save the event");

  // A file that is not there is a missing resource; anything else is ours.
  const missing = Object.assign(new Error("ENOENT"), { code: "ENOENT" });
  assert.equal(fileError(missing, "Model not found", "Cannot read").status, 404);
  const denied = Object.assign(new Error("EACCES"), { code: "EACCES" });
  assert.equal(fileError(denied, "Model not found", "Cannot read").status, 500);
});

// ---------------------------------------------------------------------------
// 4. Internal failures answer 5xx, disclose nothing, and stay in the log
// ---------------------------------------------------------------------------

test("an unreadable server configuration answers 500 and keeps the detail in the log", async () => {
  // A Node fs error carries the absolute path it failed to open in its own
  // enumerable properties. The response must carry a constant message, and the
  // log must still carry enough to diagnose it.
  const modulePath = require.resolve("../src/server/routes/devops");
  const lines = [];
  const realConsoleError = console.error;
  fs.unlinkSync(devopsFile);
  delete require.cache[modulePath];
  const coldApp = express();
  coldApp.use(express.json());
  coldApp.use("/api/devops", require(modulePath));
  const coldServer = coldApp.listen(0);
  console.error = (message) => lines.push(String(message));
  let res;
  try {
    res = await request(coldServer, "GET", "/api/devops");
  } finally {
    console.error = realConsoleError;
    coldServer.close();
    fs.writeFileSync(devopsFile, originalDevops);
    delete require.cache[modulePath];
  }

  assertErrorShape(res, 500, "GET /api/devops with an unreadable configuration");
  assert.equal(res.body.error, "Cannot get devops configuration");
  assert.ok(!res.raw.includes("devops.json"), `must not disclose the config path: ${res.raw}`);

  const logged = lines.join("\n");
  assert.ok(logged.includes("GET /api/devops"), `the log must name the request: ${logged}`);
  assert.ok(logged.includes("500"), `the log must carry the status: ${logged}`);
  assert.ok(
    logged.includes("ENOENT") && logged.includes("devops.json"),
    `the log must keep the detail the response no longer carries: ${logged}`
  );
});

test("the log keeps the detail of every failure, in one line the file logger keeps", async () => {
  // `logger/index.js` replaces console.error with a single-argument function,
  // so a handler that logged the error as a second argument would drop exactly
  // the detail it removed from the response.
  const probe = probeApp().listen(0);
  const lines = [];
  const realConsoleError = console.error;
  console.error = (...args) => lines.push(args);
  try {
    await request(probe, "GET", "/unclassified");
  } finally {
    console.error = realConsoleError;
    probe.close();
  }
  assert.equal(lines.length, 1, "one failure must produce one log line");
  assert.equal(lines[0].length, 1, "the whole detail must be in the first argument");
  const logged = String(lines[0][0]);
  assert.ok(logged.includes("/home/secret"), `the log must keep the path: ${logged}`);
  assert.ok(logged.includes("ENOENT"), `the log must keep the cause: ${logged}`);
});

test("the simulation stats endpoint answers rather than throwing", async () => {
  // It used to read a binding that is never assigned, so every call threw a
  // ReferenceError and was answered with a stack trace. Nothing is running
  // here, so the value is null; what this pins is that the endpoint answers at
  // all, and answers with the shape the dashboard reads.
  const res = await request(server, "GET", "/api/simulation/stats");
  assert.equal(res.status, 200, `stats must be served (${res.raw})`);
  assert.ok("stats" in res.body, `stats must be reported (${res.raw})`);
  assert.equal(res.body.error, null);
});

test("a run is recognised as running by the state the simulation actually keeps", () => {
  // The registry is module-private, so the predicate is asserted against the
  // class it reads: `Simulation` has no `isRunning` - it tracks `status` - and a
  // check for a property that does not exist is never true, which is what made
  // the conflict guard and the stats lookup silently dead.
  const Simulation = require("../src/core/simulation");
  const { OFFLINE, SIMULATING } = require("../src/core/DeviceStatus");
  const simulation = new Simulation({ name: "iv-stats", devices: [] }, {});
  assert.equal(
    simulation.isRunning,
    undefined,
    "a guard on isRunning would never fire"
  );
  assert.equal(simulation.status, OFFLINE, "a fresh run is not running");
  simulation.start();
  try {
    assert.equal(simulation.status, SIMULATING, "start() must mark the run running");
    assert.notEqual(simulation.status, OFFLINE);
  } finally {
    simulation.stop();
  }
  assert.equal(simulation.status, OFFLINE, "stop() must mark the run stopped");
});

// ---------------------------------------------------------------------------
// 5. The application as a whole: unknown paths, malformed bodies
// ---------------------------------------------------------------------------

test("the running application refuses unknown API paths and malformed bodies as JSON", async () => {
  const ctx = await startApp({
    SERVER_HOST: "127.0.0.1",
    RATE_LIMIT_MAX: "10000",
  });
  try {
    const unknown = await request(ctx.server, "GET", "/api/not-a-real-endpoint");
    assertErrorShape(unknown, 404, "GET an API path no router claims");
    assert.ok(
      !unknown.raw.includes("<!DOCTYPE"),
      `an unknown API path must not be answered with the dashboard: ${unknown.raw}`
    );

    const unknownPost = await request(ctx.server, "POST", "/api/not-a-real-endpoint", { a: 1 });
    assertErrorShape(unknownPost, 404, "POST an API path no router claims");

    // The dashboard itself is still served for everything else.
    const dashboard = await request(ctx.server, "GET", "/some/client/route");
    assert.equal(dashboard.status, 200, "the single-page app must still be served");
  } finally {
    ctx.server.close();
    ctx.restore();
  }
});

test("a malformed JSON body is refused with a JSON 400, not an HTML stack trace", async () => {
  const ctx = await startApp({
    SERVER_HOST: "127.0.0.1",
    RATE_LIMIT_MAX: "10000",
  });
  try {
    const res = await new Promise((resolve, reject) => {
      const http = require("node:http");
      const payload = '{"model": ';
      const req = http.request(
        {
          hostname: "127.0.0.1",
          port: ctx.port,
          path: "/api/models",
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(payload),
          },
        },
        (response) => {
          let raw = "";
          response.setEncoding("utf8");
          response.on("data", (chunk) => (raw += chunk));
          response.on("end", () => {
            let parsed = null;
            try {
              parsed = JSON.parse(raw);
            } catch (e) {
              /* not JSON */
            }
            resolve({ status: response.statusCode, body: parsed, raw });
          });
        }
      );
      req.on("error", reject);
      req.write(payload);
      req.end();
    });
    assertErrorShape(res, 400, "a malformed JSON body");
    assert.equal(res.body.error, "Malformed request body");
  } finally {
    ctx.server.close();
    ctx.restore();
  }
});

// ---------------------------------------------------------------------------
// 6. Nothing internal reaches a caller, across every failing endpoint
// ---------------------------------------------------------------------------

test("no failing endpoint discloses a server path, a stack trace or a raw error", async () => {
  const absent = `${unique("absent")}.json`;
  const failures = [
    ["GET", `/api/models/${absent}`],
    ["DELETE", `/api/models/${absent}`],
    ["GET", "/api/models/..%2Fpackage.json"],
    ["GET", `/api/data-recorders/models/${absent}`],
    ["GET", `/api/logs/simulations/${unique("absent")}_${Date.now()}.log`],
    ["GET", "/api/logs/simulations/..%2Fpackage.log"],
    ["POST", "/api/simulation/start", { modelFileName: absent }],
    ["POST", "/api/data-recorders/start", { dataRecorderFileName: absent }],
    ["POST", "/api/models", { model: { name: "../../pwned", devices: [] } }],
    ["POST", "/api/test-cases", { testCase: { id: "x", modelFileName: "../../../package.json" } }],
    ["POST", "/api/events", { event: { timestamp: 1 } }],
    ["GET", "/api/events?datasetId[$ne]=x"],
  ];
  for (const [method, routePath, body] of failures) {
    const res = await request(server, method, routePath, body);
    assert.ok(
      res.status >= 400,
      `${method} ${routePath} must not report a failure as a success: ${res.status} (${res.raw})`
    );
    assertErrorShape(res, res.status, `${method} ${routePath}`);
  }
});

// ---------------------------------------------------------------------------
// 7. The dashboard reads the status code, and still surfaces the failure
// ---------------------------------------------------------------------------

test("the dashboard's request layer honours the status code", async () => {
  // The client is a separate build that this suite cannot run, so the property
  // is asserted against its source: every request must go through the one
  // helper that looks at `response.ok`, rather than at an `error` field in a
  // body that used to always arrive with a 200.
  const apiSource = fs.readFileSync(
    path.resolve(__dirname, "../src/client/src/api/index.js"),
    "utf8"
  );
  // `apiFetch` is that single funnel on the request side (#9): it is the one
  // place the session cookie and the CSRF header are attached, so a request
  // that does not go through it would be missing both as well as the status
  // check.
  const fetches = (apiSource.match(/await apiFetch\(/g) || []).length;
  const parsed = (apiSource.match(/await parseResponse\(response[,)]/g) || []).length;
  assert.ok(fetches > 0, "the request layer must still make requests");
  assert.equal(
    parsed,
    fetches,
    "every request must be read through the helper that honours the status code"
  );
  assert.match(apiSource, /!response\.ok/, "the helper must branch on the status code");
  assert.doesNotMatch(
    apiSource,
    /throw (data|status)\.error;/,
    "no request may decide success from an error field in the body alone"
  );
  // The failure still reaches the user, and still as a string: the notification
  // renders anything else with JSON.stringify, which turns an Error into "{}".
  assert.match(apiSource, /throw errorMessage\(body, response\)/);
  assert.match(apiSource, /Request failed \(HTTP \$\{response\.status\}\)/);
});

test("the error class never lets an unsafe message through by accident", () => {
  // The message a caller sees is only ever one the code chose: `cause` is what
  // carries the underlying error, and it is not part of the response.
  const err = new ApiError(500, "Cannot save the new configuration", {
    cause: new Error("EACCES: permission denied, open '/home/secret/x.json'"),
  });
  assert.equal(err.status, 500);
  assert.equal(err.message, "Cannot save the new configuration");
  assert.ok(err.cause instanceof Error);
  assert.notEqual(
    err.message,
    err.cause.message,
    "the caller-facing message must not be the underlying one"
  );
});

// ---------------------------------------------------------------------------
// 8. A start that would orphan a run is refused, however the two arrive
// ---------------------------------------------------------------------------

test("a topology already running refuses a second start, and starts again once stopped", async () => {
  const name = unique("running-topology");
  const body = { model: { name, devices: [] }, options: {} };
  try {
    const first = await request(server, "POST", "/api/simulation/start", body);
    assert.equal(first.status, 200, `the first start must be served (${first.raw})`);

    const second = await request(server, "POST", "/api/simulation/start", body);
    assertErrorShape(second, 409, "starting a topology that is already running");

    const stopped = await request(server, "GET", `/api/simulation/stop/${name}.json`);
    assert.equal(stopped.status, 200, `the run must be stoppable (${stopped.raw})`);

    // The guard refuses a second run, not the topology: once the first one is
    // stopped the same model must be startable again.
    const third = await request(server, "POST", "/api/simulation/start", body);
    assert.equal(third.status, 200, `a stopped topology must start again (${third.raw})`);
  } finally {
    await request(server, "GET", `/api/simulation/stop/${name}.json`);
    removeRunLogs(simulationLogsDir, name);
  }
});

test("two concurrent starts of one topology cannot both be served", async () => {
  // The run is registered inside the `getDataStorage` callback, so the window
  // this pins open exists only while the default data storage has not been read
  // yet - it is cached from the first read onwards and answers synchronously
  // after that. A freshly required router and connector put the pair back in
  // the state a running server is in when the first start of the day arrives.
  const routerPath = require.resolve("../src/server/routes/simulation");
  const connectorPath = require.resolve("../src/server/routes/db-connector");
  delete require.cache[routerPath];
  delete require.cache[connectorPath];
  const coldRouter = require(routerPath);
  delete require.cache[routerPath];
  delete require.cache[connectorPath];

  const coldApp = express();
  coldApp.use(express.json());
  coldApp.use("/api/simulation", coldRouter);
  const coldServer = coldApp.listen(0);
  const name = unique("race-topology");
  const body = { model: { name, devices: [] }, options: {} };
  try {
    const answers = await Promise.all([
      request(coldServer, "POST", "/api/simulation/start", body),
      request(coldServer, "POST", "/api/simulation/start", body),
    ]);
    assert.deepEqual(
      answers.map((answer) => answer.status).sort(),
      [200, 409],
      `exactly one of two concurrent starts may be served: ${answers
        .map((answer) => answer.raw)
        .join(" | ")}`
    );
    const refused = answers.find((answer) => answer.status === 409);
    assertErrorShape(refused, 409, "the second of two concurrent starts");
  } finally {
    await request(coldServer, "GET", `/api/simulation/stop/${name}.json`);
    coldServer.close();
    removeRunLogs(simulationLogsDir, name);
  }
});

test("a data recorder already running refuses a second start", async () => {
  const name = unique("running-recorder");
  const body = { model: { name, dataRecorders: [] } };
  try {
    const first = await request(server, "POST", "/api/data-recorders/start", body);
    assert.equal(first.status, 200, `the first start must be served (${first.raw})`);

    const second = await request(server, "POST", "/api/data-recorders/start", body);
    assertErrorShape(second, 409, "starting a recorder that is already running");
  } finally {
    await request(server, "GET", `/api/data-recorders/stop/${name}.json`);
    removeRunLogs(recorderLogsDir, name);
    // A recorder connects to the configured data storage as it starts, and
    // `DataRecorder.stop()` closes only a client that finished connecting.
    // There is no database here, so the attempt is still outstanding and holds
    // this process open for the driver's whole server-selection timeout.
    // Closed through the driver's client rather than `mongoose.disconnect()`,
    // which waits for the very connection it is trying to close.
    const client = require("mongoose").connection.client;
    if (client) client.close(true, () => {});
  }
});

test("two concurrent starts of one data recorder cannot both be served", async () => {
  // As with the simulation above: the recorder is registered inside the
  // `getDataStorage` callback, so the window this pins open exists only while
  // the default data storage has not been read yet - it is cached from the
  // first read onwards and answers synchronously after that. A freshly
  // required router and connector put the pair back in the state a running
  // server is in when the first start of the day arrives.
  const routerPath = require.resolve("../src/server/routes/data-recorders");
  const connectorPath = require.resolve("../src/server/routes/db-connector");
  delete require.cache[routerPath];
  delete require.cache[connectorPath];
  const coldRouter = require(routerPath);
  delete require.cache[routerPath];
  delete require.cache[connectorPath];

  const coldApp = express();
  coldApp.use(express.json());
  coldApp.use("/api/data-recorders", coldRouter);
  const coldServer = coldApp.listen(0);
  const name = unique("race-recorder");
  const body = { model: { name, dataRecorders: [] } };
  try {
    const answers = await Promise.all([
      request(coldServer, "POST", "/api/data-recorders/start", body),
      request(coldServer, "POST", "/api/data-recorders/start", body),
    ]);
    assert.deepEqual(
      answers.map((answer) => answer.status).sort(),
      [200, 409],
      `exactly one of two concurrent starts may be served: ${answers
        .map((answer) => answer.raw)
        .join(" | ")}`
    );
    const refused = answers.find((answer) => answer.status === 409);
    assertErrorShape(refused, 409, "the second of two concurrent starts");
  } finally {
    await request(coldServer, "GET", `/api/data-recorders/stop/${name}.json`);
    coldServer.close();
    removeRunLogs(recorderLogsDir, name);
    // See the note in the test above: the connection this start opened is
    // still outstanding, and nothing in the server closes one that never
    // finished opening.
    const client = require("mongoose").connection.client;
    if (client) client.close(true, () => {});
  }
});
