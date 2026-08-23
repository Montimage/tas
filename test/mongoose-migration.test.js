// Regression tests for #27: the Mongoose layer runs on a supported major
// version with promise-based queries. No live database is needed: the model
// query surface and the driver entry points are stubbed in-process, so these
// suites pin the *contracts* this migration had to preserve — schema statics
// resolve or reject instead of taking err-first callbacks, rejected promises
// become error responses through `databaseError`, ENACTDB keeps its callback
// facade over the promise-based driver, and DataStorage's callback API (and
// its exact NULL-marker strings) is unchanged.
const test = require('node:test');
const assert = require('node:assert/strict');

const { ENACTDB } = require('../src/core/enact-mongoose');
const EventSchema = require('../src/core/enact-mongoose/schemas/EventSchema');
const DatasetSchema = require('../src/core/enact-mongoose/schemas/DatasetSchema');
const TestCaseSchema = require('../src/core/enact-mongoose/schemas/TestCaseSchema');
const mongoose = require('mongoose');
const { databaseError } = require('../src/server/middleware/errors');
const DataStorage = require('../src/core/communications/DataStorage');

// A thenable query chain answering `exec()` with `result` and recording every
// filter it was constructed with.
function fakeQuery(result, seen) {
  const query = {
    limit() {
      return query;
    },
    skip() {
      return query;
    },
    sort() {
      return query;
    },
    exec() {
      return Promise.resolve(typeof result === 'function' ? result() : result);
    },
  };
  if (seen) seen.push(query);
  return query;
}

function stubFind(model, impl) {
  const original = model.find;
  model.find = impl;
  return () => {
    model.find = original;
  };
}

test('schema statics are promise-based and resolve the found documents', async () => {
  const docs = [{ timestamp: 1 }, { timestamp: 2 }];
  const restore = stubFind(EventSchema, function (options) {
    assert.deepEqual(options, { datasetId: 'ds-1' });
    return fakeQuery(docs);
  });
  try {
    const events = await EventSchema.findEventsWithPagingOptions({ datasetId: 'ds-1' }, 2);
    assert.equal(events, docs);
  } finally {
    restore();
  }
});

test('an empty-handed find rejects with the same error marker the callbacks carried', async () => {
  const restore = stubFind(EventSchema, () => fakeQuery(null));
  try {
    await assert.rejects(
      EventSchema.findEventsWithOptions({}),
      (err) => err && err.error === 'Cannot find any event data'
    );
  } finally {
    restore();
  }
});

test('findEventsBetweenTimes composes the $and time bounds around the filter', async () => {
  let built;
  const restore = stubFind(EventSchema, function (options) {
    built = options;
    return fakeQuery([]);
  });
  try {
    await EventSchema.findEventsBetweenTimes(
      { topic: 'enact/sensors/temp-03', datasetId: 'ds-1' },
      100,
      200
    );
    assert.deepEqual(built.topic, 'enact/sensors/temp-03');
    assert.deepEqual(built.$and, [{ timestamp: { $gte: 100 } }, { timestamp: { $lte: 200 } }]);
  } finally {
    restore();
  }
});

test('dataset paging statics keep their page window on the promised query', async () => {
  let limited;
  let skipped;
  const restore = stubFind(DatasetSchema, function () {
    return {
      limit(n) {
        limited = n;
        return this;
      },
      skip(n) {
        skipped = n;
        return this;
      },
      sort() {
        return this;
      },
      exec() {
        return Promise.resolve([]);
      },
    };
  });
  try {
    const datasets = await DatasetSchema.findDatasetsWithPagingOptions(null, 3);
    assert.deepEqual(datasets, []);
    assert.equal(limited, 20);
    assert.equal(skipped, 60);
  } finally {
    restore();
  }
});

test('a null dataset filter is normalised because mongoose 9 rejects find(null)', async () => {
  // Mongoose 7+ raises ObjectParameterError for a null filter where earlier
  // majors matched every document; the unfiltered list route passes null.
  let receivedFilter = 'not called';
  const restore = stubFind(DatasetSchema, function (options) {
    receivedFilter = options;
    return fakeQuery([]);
  });
  try {
    await DatasetSchema.findDatasetsWithPagingOptions(null, 0);
    assert.deepEqual(receivedFilter, {});
  } finally {
    restore();
  }
});

test('a duplicate-key write still maps to 409 through the shared mapper', () => {
  const dup = Object.assign(new Error('E11000 duplicate key'), {
    name: 'MongoServerError',
    code: 11000,
  });
  const apiError = databaseError(dup, 'Failed to save the event');
  assert.equal(apiError.status, 409);
  assert.equal(apiError.message, 'Already exists');

  const cast = Object.assign(new Error('Cast to ObjectId failed'), { name: 'CastError' });
  assert.equal(databaseError(cast, 'x').status, 400);
  assert.equal(databaseError(cast, 'x').message, 'Invalid identifier');

  const invalid = Object.assign(new Error('validation failed'), { name: 'ValidationError' });
  assert.equal(databaseError(invalid, 'x').status, 400);

  const ours = new Error('connection refused');
  const fallback = databaseError(ours, 'Failed to save the event');
  assert.equal(fallback.status, 500);
  assert.equal(fallback.message, 'Failed to save the event');
});

test('ENACTDB.connect resolves through the promise-based driver into its callback', async () => {
  const originalConnect = mongoose.connect;
  const originalReadyState = Object.getOwnPropertyDescriptor(mongoose.connection, 'readyState');
  const db = new ENACTDB('127.0.0.1', 27017, 'tas-test-db');
  await new Promise((resolve) => {
    mongoose.connection.constructor; // touch nothing; define below
    mongoose.connect = function (connString, options) {
      assert.match(connString, /^mongodb:\/\/127\.0\.0\.1:27017$/);
      assert.equal(options.dbName, 'tas-test-db');
      assert.ok(!('useNewUrlParser' in options), 'removed options must not come back');
      Object.defineProperty(mongoose.connection, 'readyState', {
        value: 1,
        configurable: true,
      });
      return Promise.resolve();
    };
    db.connect((err) => {
      assert.equal(err, null);
      assert.equal(db.isConnected, true);
      resolve();
    });
  }).finally(() => {
    mongoose.connect = originalConnect;
    if (originalReadyState) {
      Object.defineProperty(mongoose.connection, 'readyState', originalReadyState);
    } else {
      delete mongoose.connection.readyState;
    }
  });
});

test('ENACTDB.connect reports a failed connection attempt through its callback', async () => {
  const originalConnect = mongoose.connect;
  const failure = new Error('connect ECONNREFUSED 127.0.0.1:27017');
  mongoose.connect = () => Promise.reject(failure);
  const db = new ENACTDB('127.0.0.1', 27017, 'tas-test-db');
  try {
    await new Promise((resolve) => {
      db.connect((err) => {
        assert.equal(err, failure);
        assert.equal(db.isConnected, false);
        resolve();
      });
    });
  } finally {
    mongoose.connect = originalConnect;
  }
});

test('closing without a callback stays safe for fire-and-forget stop paths', async () => {
  const originalDisconnect = mongoose.disconnect;
  mongoose.disconnect = () => Promise.resolve();
  const db = new ENACTDB('127.0.0.1', 27017, 'tas-test-db');
  try {
    db.close();
    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => {
      db.close((err) => {
        assert.equal(err, null);
        resolve();
      });
    });
  } finally {
    mongoose.disconnect = originalDisconnect;
  }
});

function fakeLogger() {
  const lines = [];
  return {
    lines,
    log: (...args) => lines.push(['log', ...args]),
    info: (...args) => lines.push(['info', ...args]),
    warn: (...args) => lines.push(['warn', ...args]),
    error: (...args) => lines.push(['error', ...args]),
    debug: (...args) => lines.push(['debug', ...args]),
  };
}

test('DataStorage.getTestCaseById keeps its callback contract and NULL marker', async () => {
  const ds = new DataStorage({ protocol: 'MONGODB', connConfig: {} }, fakeLogger());

  const originalFindOne = TestCaseSchema.findOne;
  try {
    TestCaseSchema.findOne = () => Promise.resolve(null);
    await new Promise((resolve) => {
      ds.getTestCaseById('no-such-case', (err, tc) => {
        assert.equal(err, 'Test Case is NULL');
        assert.equal(tc, null);
        resolve();
      });
    });

    const stored = { id: 'tc-1', name: 'case one' };
    TestCaseSchema.findOne = () => Promise.resolve(stored);
    await new Promise((resolve) => {
      ds.getTestCaseById('tc-1', (err, tc) => {
        assert.equal(err, null);
        assert.equal(tc, stored);
        resolve();
      });
    });

    const boom = new Error('connection destroyed');
    TestCaseSchema.findOne = () => Promise.reject(boom);
    await new Promise((resolve) => {
      ds.getTestCaseById('tc-1', (err, tc) => {
        assert.equal(err, boom);
        assert.equal(tc, null);
        resolve();
      });
    });
  } finally {
    TestCaseSchema.findOne = originalFindOne;
  }
});

test('batched writes report their rejections instead of crashing the process (issue #31)', async () => {
  const logger = fakeLogger();
  const ds = new DataStorage({ protocol: 'MONGODB', connConfig: {} }, logger, {
    maxBatchSize: 1,
    flushIntervalMs: 10,
    writeRetries: 0,
  });

  const originalInsertMany = EventSchema.insertMany;
  EventSchema.insertMany = function () {
    return Promise.reject(new Error('write concern failed'));
  };
  try {
    // The size trigger flushes on the first event; a rejection escaping the
    // drain would fail the suite as an unhandled rejection.
    await ds.saveEvent({ datasetId: 'ds-1', timestamp: 1, values: {}, isSensorData: true });
    await ds.flushEvents();
    assert.equal(ds.droppedEventCount, 1, 'the failed batch must be counted as dropped');
    assert.ok(
      logger.lines.some(
        ([level, first]) => level === 'error' && /Cannot save .*events/.test(first)
      ),
      'the dropped batch must be reported through the logger'
    );
  } finally {
    EventSchema.insertMany = originalInsertMany;
  }
});
