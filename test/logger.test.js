/**
 * Per-run logging (issues #15 and #47).
 *
 * Starting a run used to reassign the global console methods so every line on
 * the server landed in whichever run started most recently, file handles of
 * earlier runs were never released, and the single-argument replacement
 * silently dropped the error object of the very common
 * `console.error('message', err)` pair (#15). The records were also free text,
 * so nothing tied one request's or one run's lines together (#47).
 *
 * These tests pin the current shape: the factory never touches the global
 * console, each run writes only its own lines to its own file through a
 * logger passed explicitly to the code that needs it, an error logged next to
 * a message keeps its detail, stopping a run releases its handle - and every
 * record is one machine-parseable JSON object carrying the run's correlation
 * identifier, honouring LOG_LEVEL, and never repeating a secret it was handed.
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
 * Parse every complete JSON line of a log file. Returns the records plus any
 * line that failed to parse, so a test can assert machine-parseability itself
 * rather than assuming it.
 */
const parseLines = (content) => {
  const records = [];
  const unparsable = [];
  for (const line of content.split('\n')) {
    if (line.trim() === '') continue;
    try {
      records.push(JSON.parse(line));
    } catch (_) {
      unparsable.push(line);
    }
  }
  return { records, unparsable };
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

test('every record is one machine-parseable JSON object with time, level and label', async () => {
  const dir = tempLogDir('json-shape');
  const file = path.join(dir, 'run.log');
  const logger = getLogger('JSON-SHAPE', file);
  try {
    logger.info('the structured record');
    const content = await waitForFileContent(file, (c) => c.includes('the structured record'));
    const { records, unparsable } = parseLines(content);
    assert.deepEqual(unparsable, [], 'every line must parse as JSON');
    const record = records.find((r) => r.message === 'the structured record');
    assert.ok(record, 'the record must be present');
    assert.equal(record.level, 'info');
    assert.equal(record.label, 'JSON-SHAPE');
    assert.ok(record.timestamp, 'the record must carry a timestamp');
    assert.ok(!Number.isNaN(Date.parse(record.timestamp)), 'the timestamp must be ISO-8601');
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
    const { records, unparsable } = parseLines(content);
    assert.deepEqual(unparsable, [], 'every line must parse as JSON');
    const record = records.find((r) => r.message.includes('Cannot update the score'));
    assert.ok(record, 'the record must be present');
    assert.match(record.message, /Error: boom-detail/, 'the error itself must be in the message');
    assert.equal(record.label, 'ERR-DETAIL', 'the label must identify the run');
    assert.equal(record.level, 'error', 'the level must say this is an error');
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
    const [a, b] = [parseLines(contentA), parseLines(contentB)];
    assert.ok(
      a.records.every((r) => r.label === 'RUN-A'),
      'A records must be labelled RUN-A'
    );
    assert.ok(
      b.records.every((r) => r.label === 'RUN-B'),
      'B records must be labelled RUN-B'
    );
    assert.ok(!contentA.includes('line-that-belongs-to-b'), 'A must not receive B lines');
    assert.ok(!contentB.includes('line-that-belongs-to-a'), 'B must not receive A lines');
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

test('a trailing plain object becomes top-level metadata fields', async () => {
  const dir = tempLogDir('meta');
  const file = path.join(dir, 'run.log');
  const logger = getLogger('META', file);
  try {
    logger.log('values:', 42, { a: 1 });
    const content = await waitForFileContent(file, (c) => c.includes('"a"'));
    const { records } = parseLines(content);
    const record = records.find((r) => r.a === 1);
    assert.ok(record, 'the metadata must land on the record');
    assert.equal(record.message, 'values: 42', 'non-object arguments stay in the message');
    assert.equal(record.a, 1, 'object entries are hoisted to top-level fields');
  } finally {
    logger.close();
  }
});

// ---------------------------------------------------------------------------
// Structured logging (issue #47)
// ---------------------------------------------------------------------------

describe('correlation identifiers', () => {
  test('every record carries the correlation id the logger was created with', async () => {
    const dir = tempLogDir('corr');
    const file = path.join(dir, 'run.log');
    const logger = getLogger('CORR', file, { correlationId: 'sim-47-correlation' });
    try {
      logger.info('first correlated line');
      logger.warn('second correlated line');
      logger.error('third correlated line');
      const content = await waitForFileContent(file, (c) => c.includes('third correlated line'));
      const { records, unparsable } = parseLines(content);
      assert.deepEqual(unparsable, []);
      const mine = records.filter((r) => r.correlationId !== undefined);
      assert.ok(mine.length >= 3, 'all three records must be present');
      assert.ok(
        mine.every((r) => r.correlationId === 'sim-47-correlation'),
        'every record must repeat the same correlation id'
      );
    } finally {
      logger.close();
    }
  });

  test('records from two correlated loggers never mix identifiers', async () => {
    const dirA = tempLogDir('corr-a');
    const dirB = tempLogDir('corr-b');
    const loggerA = getLogger('RUN-A', path.join(dirA, 'a.log'), { correlationId: 'run-a-id' });
    const loggerB = getLogger('RUN-B', path.join(dirB, 'b.log'), { correlationId: 'run-b-id' });
    try {
      loggerA.log('a-line');
      loggerB.log('b-line');
      const [contentA, contentB] = await Promise.all([
        waitForFileContent(path.join(dirA, 'a.log'), (c) => c.includes('a-line')),
        waitForFileContent(path.join(dirB, 'b.log'), (c) => c.includes('b-line')),
      ]);
      for (const record of parseLines(contentA).records) {
        if (record.correlationId !== undefined) assert.equal(record.correlationId, 'run-a-id');
      }
      for (const record of parseLines(contentB).records) {
        if (record.correlationId !== undefined) assert.equal(record.correlationId, 'run-b-id');
      }
    } finally {
      loggerA.close();
      loggerB.close();
    }
  });

  test('a logger created without one omits the field entirely', async () => {
    const dir = tempLogDir('no-corr');
    const file = path.join(dir, 'run.log');
    const logger = getLogger('NO-CORR', file);
    try {
      logger.log('uncorrelated line');
      const content = await waitForFileContent(file, (c) => c.includes('uncorrelated line'));
      const { records } = parseLines(content);
      const record = records.find((r) => r.message === 'uncorrelated line');
      assert.ok(record, 'the record must be present');
      assert.equal(
        Object.prototype.hasOwnProperty.call(record, 'correlationId'),
        false,
        'no correlation id means no correlationId field'
      );
    } finally {
      logger.close();
    }
  });
});

describe('secret redaction', () => {
  test('sensitive keys are redacted wherever they appear in logged objects', async () => {
    const dir = tempLogDir('redact');
    const file = path.join(dir, 'run.log');
    const logger = getLogger('REDACT', file);
    try {
      logger.log('connection attempt', {
        username: 'operator',
        password: 'super-secret-pw-47',
        token: 'tok-abc',
        nested: { sessionSecret: 'sess-secret', host: '127.0.0.1' },
        apiKey: 'key-xyz',
        safe: 'plain-value',
      });
      const content = await waitForFileContent(file, (c) => c.includes('plain-value'));
      const { records } = parseLines(content);
      const record = records.find((r) => typeof r.safe === 'string' && r.safe === 'plain-value');
      assert.ok(record, 'the record with safe fields must exist');
      assert.ok(!content.includes('super-secret-pw-47'), 'password value must never appear');
      assert.ok(!content.includes('tok-abc'), 'token value must never appear');
      assert.ok(!content.includes('sess-secret'), 'nested secret value must never appear');
      assert.ok(!content.includes('key-xyz'), 'api key value must never appear');
      assert.equal(record.username, 'operator', 'non-sensitive fields survive');
      assert.equal(record.nested.host, '127.0.0.1', 'nested non-sensitive fields survive');
      assert.equal(record.password, '[REDACTED]', 'password becomes the redaction marker');
      assert.equal(record.token, '[REDACTED]');
      assert.equal(record.apiKey, '[REDACTED]');
      assert.equal(record.nested.sessionSecret, '[REDACTED]');
    } finally {
      logger.close();
    }
  });

  test('an error carrying a credential-shaped property does not leak it either', async () => {
    const dir = tempLogDir('redact-err');
    const file = path.join(dir, 'run.log');
    const logger = getLogger('REDACT-ERR', file);
    try {
      const err = new Error('connect failed');
      err.connConfig = { password: 'leaky-pw-47', host: 'db.internal' };
      logger.error('cannot store data', err);
      const content = await waitForFileContent(file, (c) => c.includes('connect failed'));
      assert.ok(!content.includes('leaky-pw-47'), 'the credential property must be redacted');
      assert.match(content, /db\.internal/, 'harmless detail stays');
    } finally {
      logger.close();
    }
  });
});

describe('log level configuration', () => {
  test('debug records are suppressed at the default level and kept under LOG_LEVEL=debug', async () => {
    const quietDir = tempLogDir('level-default');
    const quietLogger = getLogger('LEVEL-QUIET', path.join(quietDir, 'run.log'));
    try {
      quietLogger.debug('too verbose by default');
      quietLogger.info('info gets through by default');
      const content = await waitForFileContent(path.join(quietDir, 'run.log'), (c) =>
        c.includes('info gets through by default')
      );
      assert.ok(!content.includes('too verbose by default'), 'debug must be filtered at default');
    } finally {
      quietLogger.close();
    }

    process.env.LOG_LEVEL = 'debug';
    try {
      const loudDir = tempLogDir('level-debug');
      const loudLogger = getLogger('LEVEL-DEBUG', path.join(loudDir, 'run.log'));
      try {
        loudLogger.debug('verbose when configured');
        const loud = await waitForFileContent(path.join(loudDir, 'run.log'), (c) =>
          c.includes('verbose when configured')
        );
        const { records } = parseLines(loud);
        assert.ok(
          records.some((r) => r.level === 'debug'),
          'LOG_LEVEL=debug must admit debug'
        );
      } finally {
        loudLogger.close();
      }
    } finally {
      delete process.env.LOG_LEVEL;
    }
  });

  test('an unsupported LOG_LEVEL falls back to info instead of silencing the log', async () => {
    const original = process.env.LOG_LEVEL;
    process.env.LOG_LEVEL = 'chatty';
    try {
      assert.equal(getLogger('unused', '/dev/null').close ? 'ok' : 'bad', 'ok');
      const level = require('../src/server/logger').resolveLogLevel();
      assert.equal(level, 'info', 'an unusable level must fall back to info');
    } finally {
      if (original === undefined) delete process.env.LOG_LEVEL;
      else process.env.LOG_LEVEL = original;
    }
  });
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
      const [parsedA, parsedB] = [parseLines(contentA), parseLines(contentB)];
      assert.deepEqual(parsedA.unparsable, [], 'run A lines must all parse');
      assert.deepEqual(parsedB.unparsable, [], 'run B lines must all parse');
      assert.ok(
        parsedA.records.some((r) => r.label === 'SIMULATION'),
        'run A records must be labelled SIMULATION'
      );
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

  test('a started run writes every line under its own correlation id', async () => {
    const server = buildApp();
    const name = `logger-corr-${Date.now()}`;
    try {
      const start = await startRun(server, name);
      assert.equal(start.status, 200, JSON.stringify(start.body));
      const simId = getObjectId(name);
      const file = path.join(simulationsLogDir, start.body.simulationStatus[simId].logFile);

      const content = await waitForFileContent(file, (c) => c.includes(name));
      const { records } = parseLines(content);
      const correlated = records.filter((r) => r.correlationId !== undefined);
      assert.ok(correlated.length > 0, 'the run must emit correlated records');
      assert.ok(
        correlated.every((r) => r.correlationId === simId),
        'every correlated record must carry the run id'
      );
    } finally {
      await stopRun(server, name);
      removeRunLogs(name);
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
