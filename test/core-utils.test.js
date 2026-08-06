const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { readJSONFile, writeToFile } = require("../src/core/utils");

// Fixtures live in a throwaway temp directory. These tests deliberately create
// malformed files and invalid paths, which must never touch the repo's storage
// roots - the route suites assert on the contents of those directories.
let tmpDir;

before(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tas-core-utils-"));
});

after(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

/**
 * Run a function that takes a node-style callback and resolve with the
 * arguments the callback received.
 *
 * The timeout is the point: both bugs under test ended with the callback never
 * being invoked at all, and a test that simply waits for it reports a hang
 * rather than a failure. Rejecting turns "never called back" into an assertion.
 * @param {Function} invoke Receives the callback to pass to the function
 * @returns {Promise<Array>} The arguments the callback was invoked with
 */
const callbackArgs = (invoke, timeoutMs = 5000) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("the callback was never invoked")),
      timeoutMs
    );
    invoke((...args) => {
      clearTimeout(timer);
      resolve(args);
    });
  });

// ---------------------------------------------------------------------------
// readJSONFile - a parse failure must reach the callback, not the process
// ---------------------------------------------------------------------------

test("readJSONFile reports malformed JSON through the callback", async () => {
  // JSON.parse runs inside the fs.readFile callback, on a later tick than the
  // function's own try/catch. Before the fix this threw out of the callback and
  // took the whole process down instead of reaching any caller's error branch.
  const filePath = path.join(tmpDir, "malformed.json");
  fs.writeFileSync(filePath, "{ this is not json ");

  const [err, data] = await callbackArgs((cb) => readJSONFile(filePath, cb));
  assert.ok(err, "a malformed file must produce an error argument");
  assert.ok(
    err instanceof SyntaxError,
    `expected the parse failure itself, got ${err && err.constructor.name}`
  );
  assert.equal(data, undefined, "no data may be handed over alongside an error");
});

test("readJSONFile reports a missing file through the callback", async () => {
  const [err, data] = await callbackArgs((cb) =>
    readJSONFile(path.join(tmpDir, "does-not-exist.json"), cb)
  );
  assert.ok(err, "a missing file must produce an error argument");
  assert.equal(err.code, "ENOENT");
  assert.equal(data, undefined);
});

test("readJSONFile returns the parsed object for valid JSON", async () => {
  const filePath = path.join(tmpDir, "valid.json");
  const content = { name: "Temperature-Controller", devices: [], count: 3 };
  fs.writeFileSync(filePath, JSON.stringify(content));

  const [err, data] = await callbackArgs((cb) => readJSONFile(filePath, cb));
  assert.equal(err, null, `a valid file must not error (${err})`);
  assert.deepEqual(data, content);
});

// ---------------------------------------------------------------------------
// writeToFile - a synchronous throw must reach the callback, not be swallowed
// ---------------------------------------------------------------------------

// A NUL byte in a path makes fs.writeFile throw ERR_INVALID_ARG_VALUE
// synchronously, before any I/O is attempted. It is written as a char code
// because a literal NUL in source is invisible.
const nulByte = String.fromCharCode(0);

test("writeToFile reports a synchronous path failure through the callback", async () => {
  // Before the fix the empty catch swallowed this and returned without calling
  // back, so the HTTP request that asked for the write hung until its client
  // gave up. `fs.existsSync` tolerates the same path, so the non-overwrite
  // branch above reaches fs.writeFile rather than failing earlier.
  const [err] = await callbackArgs((cb) =>
    writeToFile(path.join(tmpDir, `bad${nulByte}name.json`), "{}", cb, true)
  );
  assert.ok(err, "a synchronous write failure must produce an error argument");
  assert.equal(err.code, "ERR_INVALID_ARG_VALUE");
});

test("writeToFile reports a synchronous data failure through the callback", async () => {
  // fs.writeFile validates the data argument synchronously too, so a caller
  // that passes a non-serialised value hits the same swallowed-error path.
  const [err] = await callbackArgs((cb) =>
    writeToFile(path.join(tmpDir, "bad-data.json"), 42, cb, true)
  );
  assert.ok(err, "a synchronous write failure must produce an error argument");
  assert.equal(err.code, "ERR_INVALID_ARG_TYPE");
});

test("writeToFile still writes and calls back on success", async () => {
  const filePath = path.join(tmpDir, "written.json");
  const [err] = await callbackArgs((cb) =>
    writeToFile(filePath, JSON.stringify({ ok: true }), cb, true)
  );
  assert.equal(err, null, `a legitimate write must not error (${err})`);
  assert.deepEqual(JSON.parse(fs.readFileSync(filePath, "utf8")), { ok: true });
});
