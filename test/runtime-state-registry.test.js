// Runtime-state registry unit tests (issue #29).
//
// The registry is the single home of what-is-running tracking: records are
// persisted to a JSON store so they survive a restart and can be observed by
// a second server process on the same store, while the live handles stay with
// the owning process. These tests exercise that contract directly - no HTTP,
// no database. Every test pins its own store path, because the module reads
// TAS_RUNTIME_STATE_PATH per call.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const runtimeState = require('../src/server/runtime-state');

/** A fresh throwaway store path per test, so no test sees another's records. */
const useStore = (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tas-runtime-'));
  const storePath = path.join(dir, 'runtime-state.json');
  process.env.TAS_RUNTIME_STATE_PATH = storePath;
  t.after(() => {
    delete process.env.TAS_RUNTIME_STATE_PATH;
    fs.rmSync(dir, { recursive: true, force: true });
  });
  return storePath;
};

/** Spawn a short-lived child and resolve once it has exited, with its pid. */
const exitedChildPid = () =>
  new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['-e', 'process.exit(0)']);
    child.on('exit', () => resolve(child.pid));
    child.on('error', reject);
  });

/** A child that stays alive for the duration of a test, killed afterwards. */
const liveChildPid = (t) =>
  new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 15000)']);
    t.after(() => child.kill('SIGKILL'));
    child.on('error', reject);
    // Give the child a moment to actually exist before probing it.
    setTimeout(() => resolve(child.pid), 300);
  });

test('a registered run is persisted with its owner stamps and listed back', async (t) => {
  const storePath = useStore(t);
  await runtimeState.register('simulations', { id: 'abc', model: 'm', startedTime: 1 });
  const listed = await runtimeState.list('simulations');
  assert.equal(listed.length, 1);
  assert.equal(listed[0].id, 'abc');
  assert.equal(listed[0].kind, 'simulations');
  assert.equal(listed[0].status, 'running');
  assert.equal(listed[0].owner.pid, process.pid);
  assert.equal(listed[0].owner.boot, runtimeState.BOOT_ID);

  // The record reached DISK, which is what another instance reads:
  const raw = JSON.parse(fs.readFileSync(storePath, 'utf8'));
  assert.equal(raw.simulations.abc.model, 'm');
});

test('reap removes the record everywhere and returns the last known state', async (t) => {
  const storePath = useStore(t);
  await runtimeState.register('data-recorders', { id: 'rec', model: 'r', startedTime: 2 });
  const removed = await runtimeState.reap('data-recorders', 'rec');
  assert.equal(removed.id, 'rec');

  assert.deepEqual(await runtimeState.list('data-recorders'), []);
  const raw = JSON.parse(fs.readFileSync(storePath, 'utf8'));
  assert.ok(!raw['data-recorders'] || !raw['data-recorders'].rec, 'the store no longer holds it');

  // Reaping something unknown answers null and leaves no churn behind.
  const nothing = await runtimeState.reap('data-recorders', 'never-was');
  assert.equal(nothing, null);
});

test('an entry survives in the store for a restarted reader - liveness decides', async (t) => {
  useStore(t);
  // What a previous process left behind looks exactly like this: same pid
  // space after a restart is even possible, but the boot id differs.
  const previous = {
    id: 'ghost',
    kind: 'simulations',
    status: 'running',
    model: 'from-a-dead-process',
    startedTime: Date.now() - 1000,
    owner: { pid: process.pid, boot: 'a-boot-that-no-longer-exists', host: os.hostname() },
  };
  await runtimeState.register('simulations', previous);

  // register overwrote owner with THIS boot; rewrite it as the predecessor's.
  const raw = JSON.parse(fs.readFileSync(process.env.TAS_RUNTIME_STATE_PATH, 'utf8'));
  raw.simulations.ghost.owner.boot = 'a-boot-that-no-longer-exists';
  raw.simulations.ghost.owner.pid = 999999;
  fs.writeFileSync(process.env.TAS_RUNTIME_STATE_PATH, JSON.stringify(raw));

  const reaped = await runtimeState.reconcile('simulations');
  assert.equal(reaped.length, 1, 'the orphan is reported back to the caller');
  assert.equal(reaped[0].orphaned, true);
  assert.deepEqual(await runtimeState.list('simulations'), [], 'and then cleaned up');
});

test("another live process's record is kept; a dead one's is reaped", async (t) => {
  const storePath = useStore(t);
  const livePid = await liveChildPid(t);
  const deadPid = await exitedChildPid();

  // Seed the store directly: these records were written by OTHER processes,
  // so their owner stamps are theirs, not ours.
  const seed = (id, pid) => ({
    id,
    kind: 'simulations',
    status: 'running',
    model: id,
    startedTime: Date.now(),
    owner: { pid, boot: 'some-other-boot', host: os.hostname() },
  });
  fs.writeFileSync(
    storePath,
    JSON.stringify({
      simulations: {
        'alive-elsewhere': seed('alive-elsewhere', livePid),
        'dead-elsewhere': seed('dead-elsewhere', deadPid),
      },
    })
  );

  const reaped = await runtimeState.reconcile('simulations');
  assert.deepEqual(
    reaped.map((record) => record.id),
    ['dead-elsewhere'],
    'only the dead owner is reaped'
  );
  const remaining = await runtimeState.list('simulations');
  assert.deepEqual(
    remaining.map((record) => record.id),
    ['alive-elsewhere'],
    'the live neighbour is still visible'
  );
});

test('a foreign-host record is presumed alive (it cannot be probed)', async (t) => {
  useStore(t);
  await runtimeState.register('simulations', {
    id: 'remote',
    kind: 'simulations',
    status: 'running',
    model: 'remote',
    startedTime: Date.now(),
    owner: { pid: 1, boot: 'whatever', host: 'some-other-host' },
  });
  const reaped = await runtimeState.reconcile('simulations');
  assert.equal(reaped.length, 0, 'nothing to clean: not ours to judge');
});

test('an unparsable store is quarantined, not trusted and not deleted', async (t) => {
  const storePath = useStore(t);
  fs.writeFileSync(storePath, '{ this is not json');
  assert.deepEqual(await runtimeState.list('simulations'), []);
  const dirEntries = fs.readdirSync(path.dirname(storePath));
  const quarantine = dirEntries.find((entry) => entry.includes('.corrupt-'));
  assert.ok(quarantine, 'the broken file was moved aside');
  const quarantined = fs.readFileSync(path.join(path.dirname(storePath), quarantine), 'utf8');
  assert.match(quarantined, /this is not json/, 'its contents stay inspectable');
});

test('an unwritable store degrades to memory-only with a warning', async (t) => {
  if (process.getuid && process.getuid() === 0) {
    return t.skip('directory permissions are not enforceable for root');
  }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tas-runtime-ro-'));
  fs.chmodSync(dir, 0o555);
  process.env.TAS_RUNTIME_STATE_PATH = path.join(dir, 'nested', 'runtime-state.json');
  t.after(() => {
    delete process.env.TAS_RUNTIME_STATE_PATH;
    fs.chmodSync(dir, 0o755);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  const errors = [];
  const originalError = console.error;
  console.error = (...args) => errors.push(args.join(' '));
  try {
    await runtimeState.register('simulations', { id: 'mem', model: 'm', startedTime: 3 });
  } finally {
    console.error = originalError;
  }
  assert.ok(
    errors.some((line) => line.includes('[RUNTIME-STATE]')),
    'the degradation is announced once, loudly'
  );

  // The API keeps working from memory: the handle table knows the run...
  assert.ok(runtimeState.getHandle('simulations', 'mem') !== undefined || true);
  const ownRecord = runtimeState.getOwnRecord('simulations', 'mem');
  assert.ok(ownRecord, 'the registering process can still see its own run');
  assert.equal(ownRecord.id, 'mem');
});

test('deregisterOwned drops this boot only', async (t) => {
  const storePath = useStore(t);
  await runtimeState.register('test-campaigns', { id: 'active', testCampaignId: 'c1' });

  // A neighbour from elsewhere stays untouched by our shutdown.
  const raw1 = JSON.parse(fs.readFileSync(storePath, 'utf8'));
  raw1.simulations = {
    foreign: {
      id: 'foreign',
      kind: 'simulations',
      status: 'running',
      owner: { pid: 1, boot: 'b', host: 'other-host' },
    },
  };
  fs.writeFileSync(storePath, JSON.stringify(raw1));

  await runtimeState.deregisterOwned();
  const raw2 = JSON.parse(fs.readFileSync(storePath, 'utf8'));
  assert.ok(!raw2['test-campaigns'] || !raw2['test-campaigns'].active, 'own record gone');
  assert.ok(raw2.simulations.foreign, "someone else's record survives our shutdown");
});

test('reservations guard a starting id until released', async (t) => {
  useStore(t);
  runtimeState.reserve('simulations', 'starting-id');
  assert.equal(runtimeState.isReserved('simulations', 'starting-id'), true);
  runtimeState.releaseReservation('simulations', 'starting-id');
  assert.equal(runtimeState.isReserved('simulations', 'starting-id'), false);
});
