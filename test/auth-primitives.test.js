/**
 * The primitives authentication is built out of (issue #9).
 *
 * `middleware/auth.js` is only as good as these three: a password store that
 * cannot be reversed and cannot be probed by timing, a credential that is
 * provisioned from configuration and never keeps the plaintext, and a session
 * table with two-sided expiry.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');

const { hashPassword, verifyPassword, timingSafeCompare } = require('../src/server/auth/passwords');
const { createCredential } = require('../src/server/auth/credentials');
const { createSessionStore, DEFAULT_MAX_SESSIONS } = require('../src/server/auth/session-store');
const { loadConfig } = require('../src/server/config');

const os = require('node:os');
const path = require('node:path');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ---------------------------------------------------------------------------
// passwords.js
// ---------------------------------------------------------------------------

test('a hashed password verifies, and a wrong one does not', () => {
  const hash = hashPassword('correct horse battery staple');
  assert.equal(verifyPassword('correct horse battery staple', hash), true);
  assert.equal(verifyPassword('correct horse battery stapl', hash), false);
  assert.equal(verifyPassword('', hash), false);
  assert.equal(verifyPassword('CORRECT HORSE BATTERY STAPLE', hash), false);
});

test('the stored form carries the algorithm and cost, and never the plaintext', () => {
  const hash = hashPassword('s3cr3t-value');
  assert.match(hash, /^scrypt\$16384\$8\$1\$[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+$/);
  assert.ok(!hash.includes('s3cr3t-value'), 'the plaintext must not appear in the hash');
});

test('two hashes of the same password differ, because each is salted', () => {
  const a = hashPassword('same-password');
  const b = hashPassword('same-password');
  assert.notEqual(a, b, 'an unsalted store would produce identical values');
  assert.equal(verifyPassword('same-password', a), true);
  assert.equal(verifyPassword('same-password', b), true);
});

test('a malformed stored value verifies as false rather than throwing', () => {
  for (const bad of [
    '',
    null,
    undefined,
    'not-a-hash',
    'scrypt$16384$8$1$onlyfourfields',
    'scrypt$16384$8$1$$',
    'bcrypt$16384$8$1$c2FsdA==$aGFzaA==',
    'scrypt$abc$8$1$c2FsdA==$aGFzaA==',
    'scrypt$1$8$1$c2FsdA==$aGFzaA==',
    'scrypt$16384$8$1$c2FsdA==$aGFzaA==$extra',
    {},
    12345,
  ]) {
    assert.equal(
      verifyPassword('anything', bad),
      false,
      `${JSON.stringify(bad)} should verify as false`
    );
  }
});

test('timingSafeCompare is an equality test that tolerates any input', () => {
  assert.equal(timingSafeCompare('abc', 'abc'), true);
  assert.equal(timingSafeCompare('abc', 'abd'), false);
  assert.equal(timingSafeCompare('abc', 'abcd'), false, 'a length mismatch is not equal');
  assert.equal(timingSafeCompare('', ''), true);
  assert.equal(timingSafeCompare(undefined, ''), true);
  assert.equal(timingSafeCompare(null, 'x'), false);
});

// ---------------------------------------------------------------------------
// credentials.js
// ---------------------------------------------------------------------------

test('a plaintext password is hashed at construction and not retained', () => {
  const credential = createCredential({
    authAdminUsername: 'operator',
    authAdminPassword: 'plain-password',
  });
  assert.equal(credential.configured, true);
  assert.equal(credential.source, 'password');
  assert.equal(credential.username, 'operator');
  assert.equal(credential.verify('operator', 'plain-password'), true);
  assert.equal(credential.verify('operator', 'wrong'), false);
  assert.equal(credential.verify('someone-else', 'plain-password'), false);

  // The plaintext must not be reachable from the object the rest of the
  // application holds on to.
  assert.ok(
    !JSON.stringify(credential).includes('plain-password'),
    'the plaintext must not survive on the credential'
  );
  for (const value of Object.values(credential)) {
    assert.notEqual(value, 'plain-password');
  }
});

test('the plaintext is erased from the configuration object it was read from', () => {
  // `app.js` holds the configuration object for the lifetime of the process and
  // hands it to the middleware, the router and the cookie helpers. A plaintext
  // left on it would outlive its one use and be reachable from a heap dump, a
  // debugger or a careless `console.error(config)`.
  const config = {
    authAdminUsername: 'operator',
    authAdminPassword: 'plain-password',
    AUTH_ADMIN_PASSWORD: 'plain-password',
    sessionIdleTtlMs: 1000,
  };
  const credential = createCredential(config);
  assert.equal(credential.verify('operator', 'plain-password'), true, 'the hash still verifies');
  assert.equal(config.authAdminPassword, '');
  assert.equal(config.AUTH_ADMIN_PASSWORD, '');
  assert.ok(
    !JSON.stringify(config).includes('plain-password'),
    'the plaintext must not be reachable from the config object either'
  );
  // Every other setting is untouched.
  assert.equal(config.sessionIdleTtlMs, 1000);
  assert.equal(config.authAdminUsername, 'operator');
});

test('loadConfig never exposes a plaintext password once the credential is built', () => {
  const missing = path.join(os.tmpdir(), `missing-${Date.now()}-${Math.random()}.env`);
  const saved = process.env.AUTH_ADMIN_PASSWORD;
  process.env.AUTH_ADMIN_PASSWORD = 'bootstrap-plaintext';
  try {
    const config = loadConfig({ path: missing });
    createCredential(config);
    assert.ok(
      !JSON.stringify(config).includes('bootstrap-plaintext'),
      'the loaded configuration must not retain the plaintext'
    );
  } finally {
    if (saved === undefined) delete process.env.AUTH_ADMIN_PASSWORD;
    else process.env.AUTH_ADMIN_PASSWORD = saved;
  }
});

test('a pre-hashed password takes precedence over a plaintext one', () => {
  const hash = hashPassword('the-hashed-one');
  const credential = createCredential({
    authAdminUsername: 'operator',
    authAdminPassword: 'the-plaintext-one',
    authAdminPasswordHash: hash,
  });
  assert.equal(credential.source, 'hash');
  assert.equal(credential.verify('operator', 'the-hashed-one'), true);
  assert.equal(credential.verify('operator', 'the-plaintext-one'), false);
});

test('an unconfigured credential refuses everything', () => {
  for (const config of [
    {},
    { authAdminPassword: '', authAdminPasswordHash: '' },
    { authAdminPasswordHash: '   ' },
  ]) {
    const credential = createCredential(config);
    assert.equal(credential.configured, false);
    assert.equal(credential.source, null);
    assert.equal(credential.username, 'admin', 'the default username still applies');
    assert.equal(credential.verify('admin', ''), false);
    assert.equal(credential.verify('admin', 'anything'), false);
  }
});

// ---------------------------------------------------------------------------
// session-store.js
// ---------------------------------------------------------------------------

test('a created session is retrievable, unguessable and carries its own CSRF token', () => {
  const store = createSessionStore({ idleTtlMs: 1000, absoluteTtlMs: 5000 });
  const session = store.create('operator');
  assert.equal(store.get(session.id).user, 'operator');
  assert.equal(store.size(), 1);
  assert.ok(session.id.length >= 40, 'the identifier must be long enough not to be guessed');
  assert.ok(session.csrfToken.length >= 40);
  assert.notEqual(session.id, session.csrfToken);

  const second = store.create('operator');
  assert.notEqual(second.id, session.id, 'identifiers must not repeat');
  assert.notEqual(second.csrfToken, session.csrfToken, 'tokens must not repeat');
});

test('an unknown or malformed identifier resolves to nothing', () => {
  const store = createSessionStore({});
  for (const id of ['', null, undefined, 42, 'no-such-session', {}]) {
    assert.equal(store.get(id), null, `${JSON.stringify(id)} must not resolve`);
  }
});

test('touch slides the idle window forward, and stopping ends the session', async () => {
  const store = createSessionStore({ idleTtlMs: 120, absoluteTtlMs: 60000 });
  const session = store.create('operator');
  for (let i = 0; i < 4; i += 1) {
    await sleep(50);
    assert.ok(store.touch(session.id), `touch ${i + 1} must keep the session alive`);
  }
  // Four touches spanning 200ms - well past the 120ms idle window - kept it.
  await sleep(200);
  assert.equal(store.get(session.id), null, 'an idle session must expire');
  assert.equal(store.touch(session.id), null);
});

test('the absolute lifetime is not extended by use', async () => {
  const store = createSessionStore({ idleTtlMs: 60000, absoluteTtlMs: 150 });
  const session = store.create('operator');
  await sleep(60);
  assert.ok(store.touch(session.id), 'still inside the absolute window');
  await sleep(150);
  assert.equal(store.get(session.id), null, 'the hard cap must not slide');
});

test('destroy and destroyAll invalidate sessions immediately', () => {
  const store = createSessionStore({});
  const first = store.create('operator');
  const second = store.create('operator');
  assert.equal(store.destroy(first.id), true);
  assert.equal(store.destroy(first.id), false, 'destroying twice is not an error');
  assert.equal(store.get(first.id), null);
  assert.ok(store.get(second.id), 'only the named session is destroyed');

  store.destroyAll();
  assert.equal(store.get(second.id), null);
  assert.equal(store.size(), 0);
});

test('sweep removes expired records without a timer holding the process open', async () => {
  const store = createSessionStore({ idleTtlMs: 40, absoluteTtlMs: 60000 });
  store.create('a');
  store.create('b');
  assert.equal(store.size(), 2);
  await sleep(120);
  assert.equal(store.sweep(), 2, 'both expired records must be removed');
  assert.equal(store.size(), 0);
  // Creating also sweeps, so the table cannot grow without bound.
  const live = store.create('c');
  await sleep(120);
  store.create('d');
  assert.equal(store.get(live.id), null);
  assert.equal(store.size(), 1);
});

test('the table has a hard size cap and evicts rather than growing without bound', () => {
  // Lazy expiry alone is not a bound: a caller can mint records faster than the
  // idle window ages them out. The cap is the defence in depth, mirroring how
  // the login failure tracker is bounded by FAILURE_TRACKER_LIMIT.
  const store = createSessionStore({ idleTtlMs: 60000, absoluteTtlMs: 60000, maxSessions: 5 });
  assert.equal(store.maxSessions(), 5);

  const created = [];
  for (let i = 0; i < 50; i += 1) {
    created.push(store.create(`user-${i}`));
    assert.ok(store.size() <= 5, `the table must never exceed the cap, saw ${store.size()}`);
  }
  assert.equal(store.size(), 5);
  // The five most recent survive; the earliest were evicted.
  for (const session of created.slice(-5)) {
    assert.ok(store.get(session.id), 'the most recent records must be kept');
  }
  assert.equal(store.get(created[0].id), null, 'the least recently seen record is evicted');

  // Eviction is by recency, not by creation order: a record that keeps being
  // used outlives newer, idle ones.
  const busy = created[created.length - 1];
  for (let i = 0; i < 4; i += 1) {
    assert.ok(store.touch(busy.id), 'the busy session stays alive');
    store.create(`later-${i}`);
  }
  assert.ok(store.get(busy.id), 'a session in continuous use must not be evicted');

  assert.equal(DEFAULT_MAX_SESSIONS, 1000, 'the shipped default is documented in the README');
  assert.equal(createSessionStore({}).maxSessions(), DEFAULT_MAX_SESSIONS);
});

// ---------------------------------------------------------------------------
// dead-weight guards (issue #81): removed fields and duplicated helpers must
// stay removed.
// ---------------------------------------------------------------------------

test('a session record carries no unread expiry copy', () => {
  const store = createSessionStore({ idleTtlMs: 1000, absoluteTtlMs: 5000 });
  const session = store.create('operator');
  // `expiresAt` used to be written on every record and read by nothing —
  // expiry is computed from `createdAt` + the absolute TTL. If a future change
  // wants a materialised deadline again it must also come with a reader.
  assert.equal('expiresAt' in session, false, 'no field may exist without a reader');
  assert.equal(typeof session.createdAt, 'number');
  assert.equal(typeof session.lastSeenAt, 'number');
});

test('the gate builds without a credential dependency', () => {
  const { createAuthMiddleware } = require('../src/server/middleware/auth');
  const middleware = createAuthMiddleware({
    sessions: createSessionStore({}),
    config: {
      sessionCookieSecure: false,
      sessionIdleTtlMs: 60 * 60 * 1000,
      authTrustProxyHeader: false,
      authTrustedProxies: [],
      authProxyUserHeader: 'x-forwarded-user',
    },
  });
  assert.equal(typeof middleware, 'function', 'the gate is an Express middleware');
});

test('path normalisation has exactly one home shared by the gate and CSRF guard', () => {
  const { normalizePath } = require('../src/server/middleware/auth');
  assert.equal(typeof normalizePath, 'function');
  assert.equal(
    normalizePath('/auth/login/'),
    '/auth/login',
    'a trailing slash is the same resource'
  );
  assert.equal(normalizePath('///'), '/', 'runs of trailing slashes collapse to the root');
  assert.equal(normalizePath(undefined), '/', 'absent paths normalise to the root');
});
