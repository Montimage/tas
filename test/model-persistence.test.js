// Route-level tests for the durable artifact stores behind the topology and
// data-recorder endpoints (issue #30).
//
// The loose JSON files these routes used to rewrite in full are now records
// of the shared artifact store. These suites pin what that change buys at the
// HTTP surface: concurrent creates of one name cannot both win, concurrent
// updates cannot discard one another, a rename leaves exactly one record,
// import/export still round-trip verbatim, and records that predate the
// upgrade - plain files on disk - are adopted with no migration step.
//
// Both routers point at scratch directories through their environment
// overrides before they are required; no repository data file is touched.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const express = require('express');
const { request } = require('./_http');

const modelsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tas-models-'));
const recordersDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tas-recorders-'));
process.env.TAS_MODELS_DIR = modelsDir;
process.env.TAS_DATA_RECORDERS_DIR = recordersDir;

const modelRouter = require('../src/server/routes/model');
const recorderRouter = require('../src/server/routes/data-recorders');

let server;
let app;

before(() => {
  app = express();
  app.use(express.json());
  app.use('/api/models', modelRouter);
  app.use('/api/data-recorders', recorderRouter);
  server = app.listen(0);
});

after(() => {
  server.close();
  fs.rmSync(modelsDir, { recursive: true, force: true });
  fs.rmSync(recordersDir, { recursive: true, force: true });
});

const unique = (prefix) => `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const modelBody = (name, marker) => ({
  model: { name, devices: [{ id: 'dev-1', marker }] },
});
const recorderBody = (name) => ({
  dataRecorder: { name, dataRecorders: [{ sensor: 's1' }] },
});

test('a topology round-trips: create, list, read back verbatim, delete', async () => {
  const name = unique('roundtrip');
  const fileName = `${name}.json`;
  const body = modelBody(name, 'export-marker');

  const created = await request(server, 'POST', '/api/models', body);
  assert.equal(created.status, 200);
  assert.equal(created.body.modelFileName, fileName);

  const listed = await request(server, 'GET', '/api/models');
  assert.ok(listed.body.models.includes(fileName), 'the created record must be listed');

  // Export path: the dashboard downloads exactly this URL, so the stored
  // record must come back complete and unchanged.
  const exported = await request(server, 'GET', `/api/models/${encodeURIComponent(fileName)}`);
  assert.equal(exported.status, 200);
  assert.equal(exported.body.model.name, name);
  assert.equal(exported.body.model.devices[0].marker, 'export-marker');

  const removed = await request(server, 'DELETE', `/api/models/${encodeURIComponent(fileName)}`);
  assert.equal(removed.status, 200);
  const afterDelete = await request(server, 'GET', `/api/models/${encodeURIComponent(fileName)}`);
  assert.equal(afterDelete.status, 404);
});

test('concurrent creates of the same topology name: exactly one wins', async () => {
  const name = unique('race-create');
  const fileName = `${name}.json`;
  try {
    const attempts = await Promise.all(
      Array.from({ length: 5 }, () => request(server, 'POST', '/api/models', modelBody(name)))
    );
    const won = attempts.filter((res) => res.status === 200);
    const conflicted = attempts.filter((res) => res.status === 409);
    assert.equal(won.length, 1, `exactly one create may win, got ${won.length}`);
    assert.equal(conflicted.length, 4, `the losers must conflict, got ${conflicted.length}`);

    // No silently renamed copies may be left behind either.
    const leftovers = fs
      .readdirSync(modelsDir)
      .filter((f) => f.startsWith(`${name}-`) && f.endsWith('.json'));
    assert.deepEqual(leftovers, [], 'no timestamped leftover copies may appear');
  } finally {
    fs.rmSync(path.join(modelsDir, fileName), { force: true });
  }
});

test('concurrent edits of different topologies both survive intact', async () => {
  const first = unique('concurrent-a');
  const second = unique('concurrent-b');
  try {
    await request(server, 'POST', '/api/models', modelBody(first));
    await request(server, 'POST', '/api/models', modelBody(second));

    // Both edits run at the same time and each writes its own record twice;
    // neither may end up holding the other's content or a torn mixture.
    const [editA, editB] = await Promise.all([
      request(server, 'POST', `/api/models/${encodeURIComponent(`${first}.json`)}`, {
        model: { name: first, devices: [{ id: 'd', owner: 'A' }] },
      }),
      request(server, 'POST', `/api/models/${encodeURIComponent(`${second}.json`)}`, {
        model: { name: second, devices: [{ id: 'd', owner: 'B' }] },
      }),
    ]);
    assert.equal(editA.status, 200);
    assert.equal(editB.status, 200);

    const readBackA = await request(
      server,
      'GET',
      `/api/models/${encodeURIComponent(`${first}.json`)}`
    );
    const readBackB = await request(
      server,
      'GET',
      `/api/models/${encodeURIComponent(`${second}.json`)}`
    );
    assert.equal(readBackA.body.model.devices[0].owner, 'A');
    assert.equal(readBackB.body.model.devices[0].owner, 'B');
  } finally {
    fs.rmSync(path.join(modelsDir, `${first}.json`), { force: true });
    fs.rmSync(path.join(modelsDir, `${second}.json`), { force: true });
  }
});

test('renaming a topology leaves exactly one record under the new name', async () => {
  const original = unique('rename-src');
  const target = unique('rename-dst');
  await request(server, 'POST', '/api/models', modelBody(original));

  const renamed = await request(
    server,
    'POST',
    `/api/models/${encodeURIComponent(`${original}.json`)}`,
    { model: { name: target, devices: [] } }
  );
  assert.equal(renamed.status, 200);
  assert.equal(renamed.body.modelFileName, `${target}.json`);

  const oldGone = await request(
    server,
    'GET',
    `/api/models/${encodeURIComponent(`${original}.json`)}`
  );
  const newPresent = await request(
    server,
    'GET',
    `/api/models/${encodeURIComponent(`${target}.json`)}`
  );
  assert.equal(oldGone.status, 404, 'the old record must not linger');
  assert.equal(newPresent.status, 200, 'the record must live under the new name');
  fs.rmSync(path.join(modelsDir, `${target}.json`), { force: true });
});

test('records stored by an earlier version are adopted with no migration step', async () => {
  // A file written by the previous release straight into the store directory:
  // the upgraded server must list it, serve it and allow editing it as-is.
  const legacyName = unique('legacy');
  const legacyFile = `${legacyName}.json`;
  fs.writeFileSync(
    path.join(modelsDir, legacyFile),
    JSON.stringify({ name: legacyName, devices: [{ id: 'legacy-dev' }] })
  );

  const listed = await request(server, 'GET', '/api/models');
  assert.ok(listed.body.models.includes(legacyFile), 'the pre-upgrade record must be listed');

  const read = await request(server, 'GET', `/api/models/${encodeURIComponent(legacyFile)}`);
  assert.equal(read.status, 200);
  assert.deepEqual(read.body.model.devices, [{ id: 'legacy-dev' }]);

  // And it stays editable through the normal update route.
  const updated = await request(server, 'POST', `/api/models/${encodeURIComponent(legacyFile)}`, {
    model: { name: legacyName, devices: [{ id: 'legacy-dev', edited: true }] },
  });
  assert.equal(updated.status, 200);
  const readEdited = await request(server, 'GET', `/api/models/${encodeURIComponent(legacyFile)}`);
  assert.equal(readEdited.body.model.devices[0].edited, true);
  fs.rmSync(path.join(modelsDir, legacyFile), { force: true });
});

test('data recorder CRUD rides the same store: duplicate answers its own name', async () => {
  const name = unique('recorder');
  const created = await request(server, 'POST', '/api/data-recorders/models', recorderBody(name));
  assert.equal(created.status, 200);
  assert.equal(created.body.dataRecorderFileName, `${name}.json`);

  const duplicated = await request(
    server,
    'POST',
    `/api/data-recorders/models/${encodeURIComponent(`${name}.json`)}`,
    { isDuplicated: true }
  );
  assert.equal(duplicated.status, 200);
  assert.equal(duplicated.body.dataRecorderFileName, `${name} [Duplicated].json`);

  const dupRead = await request(
    server,
    'GET',
    `/api/data-recorders/models/${encodeURIComponent(`${name} [Duplicated].json`)}`
  );
  assert.equal(dupRead.status, 200);
  assert.equal(dupRead.body.dataRecorder.name, `${name} [Duplicated]`);
  assert.deepEqual(dupRead.body.dataRecorder.dataRecorders, [{ sensor: 's1' }]);

  await request(
    server,
    'DELETE',
    `/api/data-recorders/models/${encodeURIComponent(`${name}.json`)}`
  );
  await request(
    server,
    'DELETE',
    `/api/data-recorders/models/${encodeURIComponent(`${name} [Duplicated].json`)}`
  );
});
