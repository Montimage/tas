const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const {
  isValidName,
  resolveWithin,
  NAME_MAX_LENGTH,
} = require("../src/server/routes/path-safety");

const BASE = path.resolve("/tmp/opencode/path-safety-unit");

test("isValidName accepts legitimate names", () => {
  const valid = [
    "myModel",
    "Temperature-Controller",
    "Temperature Controller Recorder",
    "202402-Temperature-Controller.json",
    "Topology [Duplicated]",
    "a_b-c.d(e)[f]+g@h'i#j",
    "0",
    "A",
  ];
  for (const name of valid) {
    assert.equal(isValidName(name), true, `expected valid: ${name}`);
  }
});

test("isValidName rejects traversal and path separator characters", () => {
  const invalid = [
    "",
    ".",
    "..",
    "../etc/passwd",
    "..%2F..%2Fetc%2Fpasswd",
    "a/b",
    "a\\b",
    "a%2Fb",
    "/etc/passwd",
    "sub\\..\\..\\etc",
    "a\u0000b",
    "a\nb",
  ];
  for (const name of invalid) {
    assert.equal(isValidName(name), false, `expected invalid: ${JSON.stringify(name)}`);
  }
});

test("isValidName rejects values that are not strings", () => {
  assert.equal(isValidName(null), false);
  assert.equal(isValidName(undefined), false);
  assert.equal(isValidName(42), false);
  assert.equal(isValidName({ name: "x" }), false);
});

test("isValidName enforces the maximum length", () => {
  const atLimit = "a".repeat(NAME_MAX_LENGTH);
  const overLimit = "a".repeat(NAME_MAX_LENGTH + 1);
  assert.equal(isValidName(atLimit), true);
  assert.equal(isValidName(overLimit), false);
});

test("resolveWithin resolves a normal relative path inside the base", () => {
  const resolved = resolveWithin(BASE, "model.json");
  assert.equal(resolved, path.resolve(BASE, "model.json"));
});

test("resolveWithin rejects traversal sequences", () => {
  const attempts = [
    "../etc/passwd",
    "../../etc/passwd",
    "..",
    "..%2F..%2Fetc%2Fpasswd",
    "a/../../etc/passwd",
    "sub/../../../etc/passwd",
    "/etc/passwd",
  ];
  for (const attempt of attempts) {
    assert.equal(resolveWithin(BASE, attempt), null, `expected reject: ${attempt}`);
  }
});

test("resolveWithin resolves a nested path that stays inside the base", () => {
  const resolved = resolveWithin(BASE, "subdir/../model.json");
  assert.equal(resolved, path.resolve(BASE, "model.json"));
});

test("resolveWithin rejects empty and non-string input", () => {
  assert.equal(resolveWithin(BASE, ""), null);
  assert.equal(resolveWithin(BASE, null), null);
  assert.equal(resolveWithin(BASE, undefined), null);
});
