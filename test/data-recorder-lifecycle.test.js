// Data recorder lifecycle integration tests — start, stop, restart, and
// concurrent runs (issue #92).
//
// Drives a real Express app mounting the data-recorder router and asserts the
// full lifecycle: start → status → stop → restart. No live MongoDB is needed:
// the default data-storage configuration is read from the committed file and
// no recorder here declares sensors that need to connect.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const { request } = require('./_http');

const recorderRouter = require('../src/server/routes/data-recorders');
const { getObjectId } = require('../src/core/utils');

const recorderLogsDir = path.resolve(__dirname, '../src/server/logs/data-recorders');

/** A scratch runtime state so this suite doesn't collide with others. */
const runtimeStorePath = path.join(
  __dirname,
  `.runtime-state-recorder-lifecycle-${process.pid}.json`
);

let server;

before(() => {
  process.env.TAS_RUNTIME_STATE_PATH = runtimeStorePath;
  fs.mkdirSync(recorderLogsDir, { recursive: true });
  const app = express();
  app.use(express.json());
  app.use('/api/data-recorders', recorderRouter);
  server = app.listen(0);
});

after(() => {
  delete process.env.TAS_RUNTIME_STATE_PATH;
  fs.rmSync(runtimeStorePath, { force: true });
  fs.rmSync(`${runtimeStorePath}.lock`, { force: true });
  server.close();
});

const unique = (prefix) => `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

/** Remove the run log a start leaves behind. */
const removeRunLogs = (name) => {
  let entries;
  try {
    entries = fs.readdirSync(recorderLogsDir);
  } catch (_) {
    return;
  }
  for (const entry of entries) {
    if (entry.startsWith(`${name}_`)) fs.unlinkSync(path.join(recorderLogsDir, entry));
  }
};

// ---------------------------------------------------------------------------
// 1. Start → status → stop lifecycle
// ---------------------------------------------------------------------------

test('a data recorder starts, appears in status, and stops cleanly', async () => {
  const name = unique('recorder-lifecycle');
  try {
    const created = await request(server, 'POST', '/api/data-recorders/models', {
      dataRecorder: { name, dataRecorders: [{ sensor: 's1' }] },
    });
    assert.equal(created.status, 200, `create must succeed (${created.raw})`);

    const started = await request(server, 'POST', '/api/data-recorders/start', {
      model: { name, dataRecorders: [{ sensor: 's1' }] },
    });
    assert.equal(started.status, 200, `start must succeed (${started.raw})`);
    assert.ok(started.body.status, `start must return status (${started.raw})`);

    const status = await request(server, 'GET', '/api/data-recorders/status');
    assert.equal(status.status, 200, `status must be served (${status.raw})`);
    const entries = status.body.status || {};
    const entry = entries[getObjectId(name)];
    assert.ok(entry, `the recorder must be in the status map (${status.raw})`);
    assert.equal(entry.isRunning, true, `the recorder must be marked running (${status.raw})`);
    assert.equal(entry.model, name, `the recorder must report its model name (${status.raw})`);

    const stopped = await request(server, 'GET', `/api/data-recorders/stop/${name}.json`);
    assert.equal(stopped.status, 200, `stop must succeed (${stopped.raw})`);

    const finalStatus = await request(server, 'GET', '/api/data-recorders/status');
    assert.equal(finalStatus.status, 200, `status must still be served (${finalStatus.raw})`);
    // The recorder is reaped: it no longer appears in the status map.
    assert.equal(
      finalStatus.body.status && finalStatus.body.status[getObjectId(name)],
      undefined,
      'the stopped recorder is reaped from the status map'
    );
  } finally {
    await request(server, 'GET', `/api/data-recorders/stop/${name}.json`);
    removeRunLogs(name);
  }
});

// ---------------------------------------------------------------------------
// 2. Restart — start the same recorder twice
// ---------------------------------------------------------------------------

test('a stopped data recorder can be restarted', async () => {
  const name = unique('recorder-restart');
  try {
    const firstStart = await request(server, 'POST', '/api/data-recorders/start', {
      model: { name, dataRecorders: [{ sensor: 's1' }] },
    });
    assert.equal(firstStart.status, 200, `first start must succeed (${firstStart.raw})`);

    const firstStatus = await request(server, 'GET', '/api/data-recorders/status');
    assert.equal(
      firstStatus.body.status[getObjectId(name)].isRunning,
      true,
      'first run must be running'
    );

    await request(server, 'GET', `/api/data-recorders/stop/${name}.json`);

    const secondStart = await request(server, 'POST', '/api/data-recorders/start', {
      model: { name, dataRecorders: [{ sensor: 's1' }] },
    });
    assert.equal(secondStart.status, 200, `re-start must succeed (${secondStart.raw})`);

    const secondStatus = await request(server, 'GET', '/api/data-recorders/status');
    const entry = secondStatus.body.status && secondStatus.body.status[getObjectId(name)];
    assert.ok(entry, 'the restarted recorder must be in the status map');
    assert.equal(entry.isRunning, true, 'the restarted recorder must be running');
    assert.notEqual(
      entry.startedTime,
      firstStart.body.status[getObjectId(name)].startedTime,
      'the restart must have a new startedTime'
    );
  } finally {
    await request(server, 'GET', `/api/data-recorders/stop/${name}.json`);
    removeRunLogs(name);
  }
});

// ---------------------------------------------------------------------------
// 3. Concurrent runs of different recorders
// ---------------------------------------------------------------------------

test('two different recorders can run concurrently', async () => {
  const first = unique('rec-concurrent-a');
  const second = unique('rec-concurrent-b');
  try {
    const starts = await Promise.all([
      request(server, 'POST', '/api/data-recorders/start', {
        model: { name: first, dataRecorders: [{ sensor: 's1' }] },
      }),
      request(server, 'POST', '/api/data-recorders/start', {
        model: { name: second, dataRecorders: [{ sensor: 's2' }] },
      }),
    ]);
    assert.deepEqual(
      starts.map((s) => s.status),
      [200, 200],
      'both starts must succeed'
    );

    const status = await request(server, 'GET', '/api/data-recorders/status');
    const entries = status.body.status || {};
    assert.ok(entries[getObjectId(first)], 'first recorder must be registered');
    assert.ok(entries[getObjectId(second)], 'second recorder must be registered');
    assert.equal(entries[getObjectId(first)].isRunning, true, 'first must be running');
    assert.equal(entries[getObjectId(second)].isRunning, true, 'second must be running');
  } finally {
    await request(server, 'GET', `/api/data-recorders/stop/${first}.json`);
    await request(server, 'GET', `/api/data-recorders/stop/${second}.json`);
    removeRunLogs(first);
    removeRunLogs(second);
  }
});

// ---------------------------------------------------------------------------
// 4. Concurrent start of the same recorder is rejected
// ---------------------------------------------------------------------------

test('starting the same recorder twice concurrently returns conflict', async () => {
  const name = unique('rec-double-start');
  try {
    const [first, second] = await Promise.all([
      request(server, 'POST', '/api/data-recorders/start', {
        model: { name, dataRecorders: [{ sensor: 's1' }] },
      }),
      request(server, 'POST', '/api/data-recorders/start', {
        model: { name, dataRecorders: [{ sensor: 's1' }] },
      }),
    ]);

    const won = first.status === 200 ? first : second;
    const lost = first.status === 200 ? second : first;

    assert.equal(won.status, 200, 'exactly one start must succeed');
    assert.equal(lost.status, 409, 'the duplicate start must be rejected with 409');
    assert.ok(lost.body && lost.body.error, 'the conflict must carry an error message');
  } finally {
    await request(server, 'GET', `/api/data-recorders/stop/${name}.json`);
    removeRunLogs(name);
  }
});

// ---------------------------------------------------------------------------
// 5. Status endpoint returns empty map when no recorders are running
// ---------------------------------------------------------------------------

test('status returns an empty map when no data recorders are running', async () => {
  const res = await request(server, 'GET', '/api/data-recorders/status');
  assert.equal(res.status, 200, `status must be served (${res.raw})`);
  assert.ok(res.body.status, 'status must be present');
  assert.deepEqual(res.body.status, {}, 'the status map must be empty when nothing is running');
});

// ---------------------------------------------------------------------------
// 6. Stop of an unknown recorder returns current status (no error)
// ---------------------------------------------------------------------------

test('stopping an unknown recorder returns current status without error', async () => {
  const name = unique('rec-unknown-stop');
  const res = await request(server, 'GET', `/api/data-recorders/stop/${name}.json`);
  assert.equal(res.status, 200, `stop of unknown must return 200 (${res.raw})`);
  assert.equal(res.body.error, null, 'no error field for unknown stop');
  const entries = res.body.status || {};
  assert.equal(
    entries[getObjectId(name)],
    undefined,
    'an unknown id must not appear in the status map'
  );
});

// ---------------------------------------------------------------------------
// 7. Model name validation: invalid names are rejected
// ---------------------------------------------------------------------------

test('a recorder with an invalid name is rejected at start', async () => {
  const name = 'invalid name with spaces!';
  const res = await request(server, 'POST', '/api/data-recorders/start', {
    model: { name, dataRecorders: [{ sensor: 's1' }] },
  });
  assert.equal(res.status, 400, `invalid name must be rejected (${res.raw})`);
  assert.ok(res.body && res.body.error, 'the rejection must carry an error');
});

// ---------------------------------------------------------------------------
// 8. Start without a model is rejected
// ---------------------------------------------------------------------------

test('starting without a model body is rejected', async () => {
  const res = await request(server, 'POST', '/api/data-recorders/start', {});
  assert.equal(res.status, 400, `missing model must be rejected (${res.raw})`);
});

// ---------------------------------------------------------------------------
// 9. Start with a model missing dataRecorders is rejected
// ---------------------------------------------------------------------------

test('starting with a model missing dataRecorders is rejected', async () => {
  const name = unique('rec-no-sensors');
  const res = await request(server, 'POST', '/api/data-recorders/start', {
    model: { name },
  });
  assert.equal(res.status, 400, `model without dataRecorders must be rejected (${res.raw})`);
});

// ---------------------------------------------------------------------------
// 10. Multiple start-stop cycles do not leak state
// ---------------------------------------------------------------------------

test('ten start-stop cycles leave the status map clean', async () => {
  const names = [];
  try {
    for (let i = 0; i < 10; i++) {
      const name = unique(`rec-cycle-${i}`);
      names.push(name);
      const started = await request(server, 'POST', '/api/data-recorders/start', {
        model: { name, dataRecorders: [{ sensor: `s${i}` }] },
      });
      assert.equal(started.status, 200, `cycle ${i} start must succeed`);
      await request(server, 'GET', `/api/data-recorders/stop/${name}.json`);
    }

    const status = await request(server, 'GET', '/api/data-recorders/status');
    assert.equal(status.status, 200, `status must be served after cycles (${status.raw})`);
    const entries = status.body.status || {};
    assert.deepEqual(entries, {}, 'all cycles must be reaped; the status map must be empty');
  } finally {
    for (const name of names) {
      await request(server, 'GET', `/api/data-recorders/stop/${name}.json`);
      removeRunLogs(name);
    }
  }
});

// ---------------------------------------------------------------------------
// 11. The status map includes all expected fields
// ---------------------------------------------------------------------------

test('a started recorder reports all expected fields in status', async () => {
  const name = unique('rec-fields');
  try {
    const started = await request(server, 'POST', '/api/data-recorders/start', {
      model: { name, dataRecorders: [{ sensor: 's1' }] },
    });
    assert.equal(started.status, 200);
    const entries = started.body.status || {};
    const entry = entries[getObjectId(name)];
    assert.ok(entry, 'the entry must exist');

    assert.equal(typeof entry.id, 'string', 'id must be a string');
    assert.equal(entry.model, name, 'model must be the name');
    assert.equal(typeof entry.startedTime, 'number', 'startedTime must be a number');
    assert.equal(typeof entry.logFile, 'string', 'logFile must be a string');
    assert.equal(typeof entry.isRunning, 'boolean', 'isRunning must be a boolean');
    assert.equal(entry.isRunning, true, 'isRunning must be true');
  } finally {
    await request(server, 'GET', `/api/data-recorders/stop/${name}.json`);
    removeRunLogs(name);
  }
});

// ---------------------------------------------------------------------------
// 12. List recorders from the artifact store
// ---------------------------------------------------------------------------

test('GET /models lists created recorders', async () => {
  const name = unique('rec-list');
  try {
    const created = await request(server, 'POST', '/api/data-recorders/models', {
      dataRecorder: { name, dataRecorders: [{ sensor: 's1' }] },
    });
    assert.equal(created.status, 200, `create must succeed (${created.raw})`);

    const listed = await request(server, 'GET', '/api/data-recorders/models');
    assert.equal(listed.status, 200, `list must succeed (${listed.raw})`);
    assert.ok(listed.body.dataRecorders, 'dataRecorders must be present');
    assert.ok(
      listed.body.dataRecorders.includes(`${name}.json`),
      'the created recorder must be listed'
    );
  } finally {
    await request(
      server,
      'DELETE',
      `/api/data-recorders/models/${encodeURIComponent(`${name}.json`)}`
    );
  }
});

// ---------------------------------------------------------------------------
// 13. Read a specific recorder by name
// ---------------------------------------------------------------------------

test('GET /models/:fileName returns a specific recorder', async () => {
  const name = unique('rec-read');
  try {
    await request(server, 'POST', '/api/data-recorders/models', {
      dataRecorder: { name, dataRecorders: [{ sensor: 's1' }], dataStorage: null, dataset: null },
    });

    const read = await request(
      server,
      'GET',
      `/api/data-recorders/models/${encodeURIComponent(`${name}.json`)}`
    );
    assert.equal(read.status, 200, `read must succeed (${read.raw})`);
    assert.equal(read.body.dataRecorder.name, name, 'name must match');
    assert.deepEqual(
      read.body.dataRecorder.dataRecorders,
      [{ sensor: 's1' }],
      'sensors must match'
    );
  } finally {
    await request(
      server,
      'DELETE',
      `/api/data-recorders/models/${encodeURIComponent(`${name}.json`)}`
    );
  }
});

// ---------------------------------------------------------------------------
// 14. Delete a recorder
// ---------------------------------------------------------------------------

test('DELETE /models/:fileName removes a recorder', async () => {
  const name = unique('rec-delete');
  try {
    await request(server, 'POST', '/api/data-recorders/models', {
      dataRecorder: { name, dataRecorders: [{ sensor: 's1' }] },
    });

    const deleted = await request(
      server,
      'DELETE',
      `/api/data-recorders/models/${encodeURIComponent(`${name}.json`)}`
    );
    assert.equal(deleted.status, 200, `delete must succeed (${deleted.raw})`);
    assert.equal(deleted.body.result, true, 'result must be true');

    const afterDelete = await request(
      server,
      'GET',
      `/api/data-recorders/models/${encodeURIComponent(`${name}.json`)}`
    );
    assert.equal(afterDelete.status, 404, 'deleted recorder must return 404');
  } finally {
    // Cleanup in case of test failure
    try {
      await request(
        server,
        'DELETE',
        `/api/data-recorders/models/${encodeURIComponent(`${name}.json`)}`
      );
    } catch (_) {
      // ignore
    }
  }
});
