/**
 * The primitives authentication is built out of (issue #9).
 *
 * `middleware/auth.js` is only as good as these three: a password store that
 * cannot be reversed and cannot be probed by timing, a credential that is
 * provisioned from configuration and never keeps the plaintext, and a session
 * table with two-sided expiry.
 */
const { test } = require("node:test");
const assert = require("node:assert/strict");

const {
  hashPassword,
  verifyPassword,
  timingSafeCompare,
} = require("../src/server/auth/passwords");
const { createCredential } = require("../src/server/auth/credentials");
const { createSessionStore } = require("../src/server/auth/session-store");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ---------------------------------------------------------------------------
// passwords.js
// ---------------------------------------------------------------------------

test("a hashed password verifies, and a wrong one does not", () => {
  const hash = hashPassword("correct horse battery staple");
  assert.equal(verifyPassword("correct horse battery staple", hash), true);
  assert.equal(verifyPassword("correct horse battery stapl", hash), false);
  assert.equal(verifyPassword("", hash), false);
  assert.equal(verifyPassword("CORRECT HORSE BATTERY STAPLE", hash), false);
});

test("the stored form carries the algorithm and cost, and never the plaintext", () => {
  const hash = hashPassword("s3cr3t-value");
  assert.match(hash, /^scrypt\$16384\$8\$1\$[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+$/);
  assert.ok(!hash.includes("s3cr3t-value"), "the plaintext must not appear in the hash");
});

test("two hashes of the same password differ, because each is salted", () => {
  const a = hashPassword("same-password");
  const b = hashPassword("same-password");
  assert.notEqual(a, b, "an unsalted store would produce identical values");
  assert.equal(verifyPassword("same-password", a), true);
  assert.equal(verifyPassword("same-password", b), true);
});

test("a malformed stored value verifies as false rather than throwing", () => {
  for (const bad of [
    "",
    null,
    undefined,
    "not-a-hash",
    "scrypt$16384$8$1$onlyfourfields",
    "scrypt$16384$8$1$$",
    "bcrypt$16384$8$1$c2FsdA==$aGFzaA==",
    "scrypt$abc$8$1$c2FsdA==$aGFzaA==",
    "scrypt$1$8$1$c2FsdA==$aGFzaA==",
    "scrypt$16384$8$1$c2FsdA==$aGFzaA==$extra",
    {},
    12345,
  ]) {
    assert.equal(
      verifyPassword("anything", bad),
      false,
      `${JSON.stringify(bad)} should verify as false`
    );
  }
});

test("timingSafeCompare is an equality test that tolerates any input", () => {
  assert.equal(timingSafeCompare("abc", "abc"), true);
  assert.equal(timingSafeCompare("abc", "abd"), false);
  assert.equal(timingSafeCompare("abc", "abcd"), false, "a length mismatch is not equal");
  assert.equal(timingSafeCompare("", ""), true);
  assert.equal(timingSafeCompare(undefined, ""), true);
  assert.equal(timingSafeCompare(null, "x"), false);
});

// ---------------------------------------------------------------------------
// credentials.js
// ---------------------------------------------------------------------------

test("a plaintext password is hashed at construction and not retained", () => {
  const credential = createCredential({
    authAdminUsername: "operator",
    authAdminPassword: "plain-password",
  });
  assert.equal(credential.configured, true);
  assert.equal(credential.source, "password");
  assert.equal(credential.username, "operator");
  assert.equal(credential.verify("operator", "plain-password"), true);
  assert.equal(credential.verify("operator", "wrong"), false);
  assert.equal(credential.verify("someone-else", "plain-password"), false);

  // The plaintext must not be reachable from the object the rest of the
  // application holds on to.
  assert.ok(
    !JSON.stringify(credential).includes("plain-password"),
    "the plaintext must not survive on the credential"
  );
  for (const value of Object.values(credential)) {
    assert.notEqual(value, "plain-password");
  }
});

test("a pre-hashed password takes precedence over a plaintext one", () => {
  const hash = hashPassword("the-hashed-one");
  const credential = createCredential({
    authAdminUsername: "operator",
    authAdminPassword: "the-plaintext-one",
    authAdminPasswordHash: hash,
  });
  assert.equal(credential.source, "hash");
  assert.equal(credential.verify("operator", "the-hashed-one"), true);
  assert.equal(credential.verify("operator", "the-plaintext-one"), false);
});

test("an unconfigured credential refuses everything", () => {
  for (const config of [
    {},
    { authAdminPassword: "", authAdminPasswordHash: "" },
    { authAdminPasswordHash: "   " },
  ]) {
    const credential = createCredential(config);
    assert.equal(credential.configured, false);
    assert.equal(credential.source, null);
    assert.equal(credential.username, "admin", "the default username still applies");
    assert.equal(credential.verify("admin", ""), false);
    assert.equal(credential.verify("admin", "anything"), false);
  }
});

// ---------------------------------------------------------------------------
// session-store.js
// ---------------------------------------------------------------------------

test("a created session is retrievable, unguessable and carries its own CSRF token", () => {
  const store = createSessionStore({ idleTtlMs: 1000, absoluteTtlMs: 5000 });
  const session = store.create("operator");
  assert.equal(store.get(session.id).user, "operator");
  assert.equal(store.size(), 1);
  assert.ok(session.id.length >= 40, "the identifier must be long enough not to be guessed");
  assert.ok(session.csrfToken.length >= 40);
  assert.notEqual(session.id, session.csrfToken);

  const second = store.create("operator");
  assert.notEqual(second.id, session.id, "identifiers must not repeat");
  assert.notEqual(second.csrfToken, session.csrfToken, "tokens must not repeat");
});

test("an unknown or malformed identifier resolves to nothing", () => {
  const store = createSessionStore({});
  for (const id of ["", null, undefined, 42, "no-such-session", {}]) {
    assert.equal(store.get(id), null, `${JSON.stringify(id)} must not resolve`);
  }
});

test("touch slides the idle window forward, and stopping ends the session", async () => {
  const store = createSessionStore({ idleTtlMs: 120, absoluteTtlMs: 60000 });
  const session = store.create("operator");
  for (let i = 0; i < 4; i += 1) {
    await sleep(50);
    assert.ok(store.touch(session.id), `touch ${i + 1} must keep the session alive`);
  }
  // Four touches spanning 200ms - well past the 120ms idle window - kept it.
  await sleep(200);
  assert.equal(store.get(session.id), null, "an idle session must expire");
  assert.equal(store.touch(session.id), null);
});

test("the absolute lifetime is not extended by use", async () => {
  const store = createSessionStore({ idleTtlMs: 60000, absoluteTtlMs: 150 });
  const session = store.create("operator");
  await sleep(60);
  assert.ok(store.touch(session.id), "still inside the absolute window");
  await sleep(150);
  assert.equal(store.get(session.id), null, "the hard cap must not slide");
});

test("destroy and destroyAll invalidate sessions immediately", () => {
  const store = createSessionStore({});
  const first = store.create("operator");
  const second = store.create("operator");
  assert.equal(store.destroy(first.id), true);
  assert.equal(store.destroy(first.id), false, "destroying twice is not an error");
  assert.equal(store.get(first.id), null);
  assert.ok(store.get(second.id), "only the named session is destroyed");

  store.destroyAll();
  assert.equal(store.get(second.id), null);
  assert.equal(store.size(), 0);
});

test("sweep removes expired records without a timer holding the process open", async () => {
  const store = createSessionStore({ idleTtlMs: 40, absoluteTtlMs: 60000 });
  store.create("a");
  store.create("b");
  assert.equal(store.size(), 2);
  await sleep(120);
  assert.equal(store.sweep(), 2, "both expired records must be removed");
  assert.equal(store.size(), 0);
  // Creating also sweeps, so the table cannot grow without bound.
  const live = store.create("c");
  await sleep(120);
  store.create("d");
  assert.equal(store.get(live.id), null);
  assert.equal(store.size(), 1);
});
