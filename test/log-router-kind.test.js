const { test } = require('node:test');
const assert = require('node:assert/strict');

const createLogRouter = require('../src/server/routes/logs');

// Issue #84: the factory used to default its kind to a boolean that was then
// interpolated into a directory path, so a caller forgetting the argument got
// a router serving a literal `true` directory instead of failing loudly.

test('mounting with no argument throws loudly', () => {
  assert.throws(() => createLogRouter(), TypeError);
});

test('mounting with the retired boolean default throws', () => {
  assert.throws(() => createLogRouter(true), /Unknown log kind: true/);
});

test('mounting with an unknown kind throws naming the kind', () => {
  assert.throws(() => createLogRouter('simulation'), /Unknown log kind: simulation/);
});

test('the thrown message lists every known log kind', () => {
  assert.throws(() => createLogRouter(), /data-recorders, simulations, test-campaigns/);
});

test('each of the three known kinds mounts without throwing', () => {
  for (const kind of ['data-recorders', 'simulations', 'test-campaigns']) {
    const router = createLogRouter(kind);
    assert.equal(typeof router, 'function');
  }
});
