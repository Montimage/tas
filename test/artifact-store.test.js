// Unit tests for the artifact store (issue #30): the one place topology,
// data-recorder and service-configuration records are read and written.
//
// The guarantees under test are exactly the ones the loose JSON files could
// not make: writes are atomic (a crash mid-write leaves the previous record
// readable, never a truncated file), mutations serialize (two overlapping
// edits cannot silently discard one another), unparsable records are
// quarantined instead of served or deleted, and record names cannot escape
// the store's root directory. Every suite runs against a scratch directory -
// nothing here touches a live database or the repository's data files.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const { createArtifactStore } = require('../src/server/artifact-store');

function scratchDir(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tas-artifacts-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

test('write then read round-trips a record', async (t) => {
  const store = createArtifactStore({ root: scratchDir(t), label: 'unit' });
  const doc = { name: 'topology', devices: [{ id: 1 }] };
  await store.write('topology.json', doc);
  assert.deepEqual(await store.read('topology.json'), doc);
});

test('list returns only bare .json records, sorted, ignoring write artifacts', async (t) => {
  const root = scratchDir(t);
  const store = createArtifactStore({ root, label: 'unit' });
  await store.write('b.json', {});
  await store.write('a.json', {});
  // Artifacts of an interrupted write / a quarantine must never be listed.
  fs.writeFileSync(path.join(root, 'c.json.123.456.tmp'), '{');
  fs.writeFileSync(path.join(root, 'd.json.corrupt-789'), '{');
  assert.deepEqual(await store.list(), ['a.json', 'b.json']);
});

test('writing over an existing name without overwrite conflicts', async (t) => {
  const store = createArtifactStore({ root: scratchDir(t), label: 'unit' });
  await store.write('x.json', { v: 1 });
  await assert.rejects(store.write('x.json', { v: 2 }), (err) => {
    assert.equal(err.code, 'EARTIFACTCONFLICT');
    return true;
  });
  assert.deepEqual(await store.read('x.json'), { v: 1 }, 'the original must survive');
  await store.write('x.json', { v: 3 }, { overwrite: true });
  assert.deepEqual(await store.read('x.json'), { v: 3 });
});

test('reading an absent record throws an ENOENT-shaped error', async (t) => {
  const store = createArtifactStore({ root: scratchDir(t), label: 'unit' });
  await assert.rejects(store.read('absent.json'), (err) => err.code === 'ENOENT');
  await assert.rejects(store.remove('absent.json'), (err) => err.code === 'ENOENT');
});

test('rename moves the record and removes the old copy in one step', async (t) => {
  const root = scratchDir(t);
  const store = createArtifactStore({ root, label: 'unit' });
  await store.write('old.json', { name: 'old' });
  const renamed = await store.rename('old.json', 'new.json', (doc) => ({
    ...doc,
    name: 'new',
  }));
  assert.equal(renamed.name, 'new');
  assert.deepEqual(await store.read('new.json'), { name: 'new' });
  assert.deepEqual(await store.list(), ['new.json'], 'the old copy must be gone');
});

test('rename onto an existing name conflicts and keeps both records', async (t) => {
  const store = createArtifactStore({ root: scratchDir(t), label: 'unit' });
  await store.write('a.json', { v: 'a' });
  await store.write('b.json', { v: 'b' });
  await assert.rejects(store.rename('a.json', 'b.json'), (err) => {
    assert.equal(err.code, 'EARTIFACTCONFLICT');
    return true;
  });
  assert.deepEqual(await store.read('a.json'), { v: 'a' });
  assert.deepEqual(await store.read('b.json'), { v: 'b' });
});

test('record names cannot escape the root directory', async (t) => {
  const store = createArtifactStore({ root: scratchDir(t), label: 'unit' });
  for (const bad of [
    '../escape.json',
    'sub/escape.json',
    '/absolute.json',
    '..',
    '.',
    'no-extension',
    '',
    null,
  ]) {
    await assert.rejects(
      store.read(/** @type {*} */ (bad)),
      (err) => err.code === 'EARTIFACTPATH',
      `expected ${JSON.stringify(bad)} to be refused`
    );
  }
});

test('an interrupted write never damages the stored record', async (t) => {
  const root = scratchDir(t);
  const store = createArtifactStore({ root, label: 'unit' });
  await store.write('rec.json', { generation: 1 });

  // Simulate a crash mid-write: the temporary file is on disk, the rename
  // never happened. The previous record must still read back whole, and the
  // orphaned temporary file must not surface as a record.
  fs.writeFileSync(path.join(root, 'rec.json.999.111.tmp'), '{"generation": 2');

  assert.deepEqual(await store.read('rec.json'), { generation: 1 });
  assert.deepEqual(await store.list(), ['rec.json']);
});

test('a failed write cleans its temporary file and leaves the target intact', async (t) => {
  const root = scratchDir(t);
  const store = createArtifactStore({ root, label: 'unit' });
  await store.write('rec.json', { keep: true });

  // Break exactly the rename step: the temp write succeeds, the swap fails.
  const fsp = require('node:fs/promises');
  const realRename = fsp.rename;
  fsp.rename = async () => {
    throw Object.assign(new Error('disk went away'), { code: 'EACCES' });
  };
  t.after(() => {
    fsp.rename = realRename;
  });

  await assert.rejects(store.write('rec.json', { gone: true }, { overwrite: true }));
  assert.deepEqual(await store.read('rec.json'), { keep: true });
  const leftovers = fs.readdirSync(root).filter((f) => f.endsWith('.tmp'));
  assert.deepEqual(leftovers, [], 'the failed temporary file must be cleaned up');
});

test('an unparsable record is quarantined, not served or deleted', async (t) => {
  const root = scratchDir(t);
  const store = createArtifactStore({ root, label: 'unit' });
  fs.writeFileSync(path.join(root, 'broken.json'), '{"truncated": tru');

  await assert.rejects(store.read('broken.json'), (err) => {
    assert.equal(err.code, 'EARTIFACTCORRUPT');
    return true;
  });
  assert.deepEqual(await store.list(), [], 'the broken record no longer lists');
  const quarantined = fs.readdirSync(root).filter((f) => f.startsWith('broken.json.corrupt-'));
  assert.equal(quarantined.length, 1, 'the content stays inspectable beside the original');
});

test('concurrent writes all land - none is lost, the file always parses', async (t) => {
  const root = scratchDir(t);
  const store = createArtifactStore({ root, label: 'unit' });

  const writes = [];
  for (let i = 0; i < 30; i++) {
    writes.push(store.write(`rec-${i}.json`, { i }, { overwrite: true }));
  }
  await Promise.all(writes);

  const listed = await store.list();
  assert.equal(listed.length, 30);
  for (const fileName of listed) {
    const doc = await store.read(fileName);
    assert.ok(Number.isInteger(doc.i), `${fileName} must hold one complete record`);
  }
});

test('overlapping edits of one record serialize instead of discarding', async (t) => {
  const root = scratchDir(t);
  const store = createArtifactStore({ root, label: 'unit' });
  await store.write('counter.json', { count: 0 });

  // The lost-update shape from the issue: two writers each read the current
  // state and write their own change back. Under the old full-file
  // read-modify-write one writer's change silently vanished; serialized
  // through the store, every increment survives.
  const bump = () =>
    store.withExclusive(async (unlocked) => {
      const doc = await unlocked.read('counter.json');
      await unlocked.writeRaw('counter.json', { count: doc.count + 1 });
    });
  await Promise.all([bump(), bump(), bump(), bump(), bump()]);

  assert.deepEqual(await store.read('counter.json'), { count: 5 });
});

test('a lock left behind by a crashed holder is stolen once stale', async (t) => {
  const root = scratchDir(t);
  const store = createArtifactStore({ root, label: 'unit' });
  const staleLock = path.join(root, '.unit.lock');
  fs.writeFileSync(staleLock, '');
  // Backdate far past LOCK_STALE_MS so the first retry steals it. utimesSync
  // takes Date objects here - raw numbers are interpreted as seconds.
  const staleTime = new Date(Date.now() - 60000);
  fs.utimesSync(staleLock, staleTime, staleTime);

  await store.write('after.json', { ok: true });
  assert.deepEqual(await store.read('after.json'), { ok: true });
});
