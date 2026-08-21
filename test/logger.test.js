/**
 * Per-run logging (issue #15).
 *
 * Starting a run used to reassign the global console methods so every line on
 * the server landed in whichever run started most recently, file handles of
 * earlier runs were never released, and the single-argument replacement
 * silently dropped the error object of the very common
 * `console.error('message', err)` pair.
 *
 * These tests pin the replacement shape: the factory never touches the global
 * console, each run writes only its own lines to its own file through a logger
 * passed explicitly to the code that needs it, an error logged next to a
 * message keeps its detail, and stopping a run releases its handle.
 */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const express = require('express');

const getLogger = require('../src/server/logger');
const simulationRouter = require('../src/server/routes/simulation');
const { getObjectId } = require('../src/core/utils');

/** A fresh temporary directory for one test's log files. */
const tempLogDir = (name) => fs.mkdtempSync(path.join(os.tmpdir(), `tas-logger-${name}-`));

/** Count the open file descriptors of this process (Linux only). */
const openFdCount = () => {
  try {
    return fs.readdirSync('/proc/self/fd').length;
  } catch (_) {
    return null;
  }
};

/**
 * Wait until reading `file` satisfies `predicate`, polling because winston
 * writes asynchronously. Resolves with the file content; rejects on timeout.
 */
const waitForFileContent = (file, predicate, timeout = 3000) =>
  new Promise((resolve, reject) => {
    const started = Date.now();
    const tick = () => {
      let content = '';
      try {
        content = fs.readFileSync(file, 'utf8');
      } catch (_) {
        /* not written yet */
      }
      if (predicate(content)) return resolve(content);
      if (Date.now() - started > timeout) {
        return reject(new Error(`log content never settled: ${JSON.stringify(content)}`));
      }
      setTimeout(tick, 50);
    };
    tick();
  });

/** Wait until `probe` returns a value that satisfies `predicate`. */
const waitFor = (probe, predicate, timeout = 5000) =>
  new Promise((resolve, reject) => {
    const started = Date.now();
    const tick = () => {
      let value;
      try {
        value = probe();
      } catch (_) {
        value = null;
      }
      if (predicate(value)) return resolve(value);
      if (Date.now() - started > timeout) {
        return reject(new Error('condition never settled'));
      }
      setTimeout(tick, 50);
    };
    tick();
  });

// ---------------------------------------------------------------------------
// The factory itself
// ---------------------------------------------------------------------------

test('the logger factory never reassigns global console methods', () => {
  const dir = tempLogDir('no-hijack');
  const before = { log: console.log, error: console.error, warn: console.warn };
  const logger = getLogger('NO-HIJACK', path.join(dir, 'run.log'));
  try {
    assert.equal(console.log, before.log, 'console.log must stay native');
    assert.equal(console.error, before.error, 'console.error must stay native');
    assert.equal(console.warn, before.warn, 'console.warn must stay native');
    // Logging through the returned logger must not quietly hijack either.
    logger.log('a line');
    assert.equal(console.log, before.log, 'logging must not reassign console.log');
  } finally {
    logger.close();
  }
});

test('a message logged together with an error keeps the error detail', async () => {
  const dir = tempLogDir('error-detail');
  const file = path.join(dir, 'run.log');
  const logger = getLogger('ERR-DETAIL', file);
  try {
    logger.error('Cannot update the score for report r-1', new Error('boom-detail'));
    const content = await waitForFileContent(file, (c) => c.includes('boom-detail'));
    assert.match(content, /Cannot update the score for report r-1/);
    assert.match(content, /Error: boom-detail/, 'the error itself must be in the log');
    assert.match(content, /\[ERR-DETAIL\]/, 'the label must identify the run');
    assert.match(content, /error:/, 'the level must say this is an error');
  } finally {
    logger.close();
  }
});

test('two runs started concurrently write only their own lines to their own files', async () => {
  const dirA = tempLogDir('iso-a');
  const dirB = tempLogDir('iso-b');
  const fileA = path.join(dirA, 'a.log');
  const fileB = path.join(dirB, 'b.log');
  const loggerA = getLogger('RUN-A', fileA);
  const loggerB = getLogger('RUN-B', fileB);
  try {
    loggerA.log('line-that-belongs-to-a');
    loggerB.log('line-that-belongs-to-b');

    const [contentA, contentB] = await Promise.all([
      waitForFileContent(fileA, (c) => c.includes('line-that-belongs-to-a')),
      waitForFileContent(fileB, (c) => c.includes('line-that-belongs-to-b')),
    ]);
    assert.ok(!contentA.includes('line-that-belongs-to-b'), 'A must not receive B lines');
    assert.ok(!contentB.includes('line-that-belongs-to-a'), 'B must not receive A lines');
    assert.match(contentA, /\[RUN-A\]/);
    assert.match(contentB, /\[RUN-B\]/);
  } finally {
    loggerA.close();
    loggerB.close();
  }
});

test('closing a run logger releases its handle and stays safe afterwards', async () => {
  if (openFdCount() === null) return; // /proc unavailable: nothing to count
  const dir = tempLogDir('release');
  const baseline = openFdCount();

  for (let cycle = 0; cycle < 5; cycle += 1) {
    const logger = getLogger(`CYCLE-${cycle}`, path.join(dir, `cycle-${cycle}.log`));
    logger.log(`cycle ${cycle} wrote a line`);
    await waitForFileContent(path.join(dir, `cycle-${cycle}.log`), (c) =>
      c.includes(`cycle ${cycle} wrote a line`)
    );
    logger.close();
    logger.close(); // idempotent
  }

  await waitFor(openFdCount, (n) => n !== null && n <= baseline);

  // After close, a late asynchronous callback may still log: it must not
  // throw, and the line must stay visible on the process console.
  const late = getLogger('LATE', path.join(dir, 'late.log'));
  late.log('before close');
  await waitForFileContent(path.join(dir, 'late.log'), (c) => c.includes('before close'));
  late.close();
  const seen = [];
  const original = console.log;
  console.log = (...args) => seen.push(args.join(' '));
  try {
    late.log('after close');
    late.error('late error after close');
  } finally {
    console.log = original;
  }
  assert.ok(
    seen.some((l) => l.includes('after close')),
    `post-close lines fall back to the console: ${seen.join(' | ')}`
  );
  assert.ok(
    !seen.some((l) => l.includes('late error after close')),
    'an error after close goes to console.error, not console.log'
  );
});

test('the wrapper formats multiple arguments like console.log does', async () => {
  const dir = tempLogDir('variadic');
  const file = path.join(dir, 'run.log');
  const logger = getLogger('VARIADIC', file);
  try {
    logger.log('values:', 42, { a: 1 });
    const content = await waitForFileContent(file, (c) => c.includes('42'));
    assert.match(content, /values: 42 \{ a: 1 \}/);
  } finally {
    logger.close();
  }
});

// ---------------------------------------------------------------------------
// Through the route that starts runs
// ---------------------------------------------------------------------------

describe('simulation routes', () => {
  /** Minimal valid data storage: never connected, only satisfies validation. */
  const dataStorageOption = () => ({
    protocol: 'MONGODB',
    connConfig: {
      host: '127.0.0.1',
      port: 27017,
      username: null,
      password: null,
      dbname: 'tasdb',
      options: null,
    },
  });

  const buildApp = () => {
    const app = express();
    app.use(express.json());
    app.use('/api/simulation', simulationRouter);
    return app.listen(0);
  };

  const startRun = (server, name) =>
    fetch(`http://127.0.0.1:${server.address().port}/api/simulation/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: { name, devices: [] },
        options: { dataStorage: dataStorageOption() },
      }),
    }).then(async (res) => ({ status: res.status, body: await res.json() }));

  const stopRun = (server, name) =>
    fetch(
      `http://127.0.0.1:${server.address().port}/api/simulation/stop/${encodeURIComponent(
        name
      )}.json`
    ).then((res) => res.status);

  const simulationsLogDir = path.resolve(__dirname, '../src/server/logs/simulations');

  const removeRunLogs = (name) => {
    try {
      for (const entry of fs.readdirSync(simulationsLogDir)) {
        if (entry.startsWith(`${name}_`)) {
          fs.unlinkSync(path.join(simulationsLogDir, entry));
        }
      }
    } catch (_) {
      /* directory absent */
    }
  };

  test("two concurrent runs log into their own files, not each other's", async () => {
    const server = buildApp();
    const nameA = `logger-iso-a-${Date.now()}`;
    const nameB = `logger-iso-b-${Date.now()}`;
    try {
      const [startA, startB] = await Promise.all([
        startRun(server, nameA),
        startRun(server, nameB),
      ]);
      assert.equal(startA.status, 200, JSON.stringify(startA.body));
      assert.equal(startB.status, 200, JSON.stringify(startB.body));

      const fileA = path.join(
        simulationsLogDir,
        startA.body.simulationStatus[getObjectId(nameA)].logFile
      );
      const fileB = path.join(
        simulationsLogDir,
        startB.body.simulationStatus[getObjectId(nameB)].logFile
      );

      const [contentA, contentB] = await Promise.all([
        waitForFileContent(fileA, (c) => c.includes(nameA)),
        waitForFileContent(fileB, (c) => c.includes(nameB)),
      ]);
      assert.match(contentA, /\[SIMULATION\]/);
      assert.ok(!contentA.includes(nameB), 'run A must not receive run B lines');
      assert.ok(!contentB.includes(nameA), 'run B must not receive run A lines');
    } finally {
      await stopRun(server, nameA);
      await stopRun(server, nameB);
      removeRunLogs(nameA);
      removeRunLogs(nameB);
      await new Promise((resolve) => server.close(resolve));
    }
  });

  test('repeated start/stop cycles do not grow the number of open handles', async () => {
    if (openFdCount() === null) return; // /proc unavailable: nothing to count
    const server = buildApp();
    const name = `logger-cycle-${Date.now()}`;
    const cycles = 4;
    try {
      const baseline = openFdCount();
      for (let cycle = 0; cycle < cycles; cycle += 1) {
        const start = await startRun(server, `${name}-${cycle}`);
        assert.equal(start.status, 200, JSON.stringify(start.body));
        const stopped = await stopRun(server, `${name}-${cycle}`);
        assert.equal(stopped, 200);
        removeRunLogs(`${name}-${cycle}`);
      }
      await waitFor(openFdCount, (n) => n !== null && n <= baseline);
    } finally {
      for (let cycle = 0; cycle < cycles; cycle += 1) removeRunLogs(`${name}-${cycle}`);
      await new Promise((resolve) => server.close(resolve));
    }
  });
});
