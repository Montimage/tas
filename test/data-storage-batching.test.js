// Batched event writes (issue #31).
//
// saveEvent used to open one document save per message with any failure
// logged and forgotten. Writes now queue and flush as one insertMany when a
// size trigger (eventBatchSize documents) or time trigger
// (eventFlushIntervalMs) fires; failed batches retry before being counted,
// reported, and handed to the onDrop hook; stop() drains the queue before
// closing the client. insertMany is stubbed at the model boundary - the same
// seam test/data-storage.test.js and test/mongoose-migration.test.js use - so
// no live MongoDB is involved.
const { test } = require('node:test');
const assert = require('node:assert/strict');

const DataStorage = require('../src/core/communications/DataStorage');
const EventSchema = require('../src/core/enact-mongoose/schemas/EventSchema');

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

// Stub insertMany for the duration of one test, recording every call.
function stubInsertMany(impl) {
  const calls = [];
  const original = EventSchema.insertMany;
  EventSchema.insertMany = function (docs, options) {
    calls.push({ docs, options });
    return impl ? impl(docs, options) : Promise.resolve(docs);
  };
  return { calls, restore: () => (EventSchema.insertMany = original) };
}

const event = (n) => ({ datasetId: 'ds-1', timestamp: n, values: {}, isSensorData: true });

test('the size trigger flushes one batch of eventBatchSize events', async () => {
  const logger = fakeLogger();
  const ds = new DataStorage({ protocol: 'MONGODB', connConfig: {} }, logger, {
    maxBatchSize: 3,
    flushIntervalMs: 60000,
  });
  const stub = stubInsertMany(null);
  try {
    await ds.saveEvent(event(1));
    await ds.saveEvent(event(2));
    assert.deepEqual(stub.calls, [], 'nothing may flush below the size trigger');

    await ds.saveEvent(event(3));
    await ds.flushEvents();
    assert.equal(stub.calls.length, 1, 'the size trigger must produce exactly one write');
    assert.equal(stub.calls[0].docs.length, 3);
    assert.deepEqual(stub.calls[0].options, { ordered: false });
    assert.equal(ds.savedEventCount, 3);
    assert.equal(ds.pendingEvents.length, 0);
  } finally {
    stub.restore();
  }
});

test('the time trigger flushes an under-sized queue', async () => {
  const logger = fakeLogger();
  const ds = new DataStorage({ protocol: 'MONGODB', connConfig: {} }, logger, {
    maxBatchSize: 100,
    flushIntervalMs: 25,
  });
  const stub = stubInsertMany(null);
  try {
    await ds.saveEvent(event(1));
    await ds.saveEvent(event(2));
    // Well past the interval: the armed timer must have flushed both without
    // the caller asking.
    await new Promise((resolve) => setTimeout(resolve, 120));
    assert.equal(stub.calls.length, 1, 'the timer must flush the queue exactly once');
    assert.equal(stub.calls[0].docs.length, 2);
    assert.equal(ds.pendingEvents.length, 0);

    await new Promise((resolve) => setTimeout(resolve, 80));
    assert.equal(stub.calls.length, 1, 'an empty queue must not be written again');
  } finally {
    stub.restore();
  }
});

test('concurrent triggers share one drain instead of interleaving batches', async () => {
  const logger = fakeLogger();
  const ds = new DataStorage({ protocol: 'MONGODB', connConfig: {} }, logger, {
    maxBatchSize: 2,
    flushIntervalMs: 5,
  });
  let release;
  const gate = new Promise((resolve) => (release = resolve));
  const stub = stubInsertMany(async () => gate);
  try {
    await ds.saveEvent(event(1));
    await ds.saveEvent(event(2)); // size trigger starts a drain gated on `gate`
    await ds.saveEvent(event(3));
    const second = ds.flushEvents(); // must join the in-flight chain
    release();
    await Promise.all([ds.flushEvents(), second]);
    assert.equal(stub.calls.length, 2, 'two sequential batches, never interleaved');
    assert.deepEqual(
      stub.calls.map((c) => c.docs.length),
      [2, 1]
    );
  } finally {
    stub.restore();
  }
});

test('a failing batch is retried before it is dropped and reported', async () => {
  const logger = fakeLogger();
  const dropped = [];
  const ds = new DataStorage({ protocol: 'MONGODB', connConfig: {} }, logger, {
    maxBatchSize: 2,
    flushIntervalMs: 60000,
    writeRetries: 2,
    onDrop: (b) => dropped.push(b.length),
  });
  let attempts = 0;
  const stub = stubInsertMany(async () => {
    attempts += 1;
    if (attempts <= 2) throw new Error('transient outage');
    return [];
  });
  try {
    await ds.saveEvent(event(1));
    await ds.saveEvent(event(2));
    await ds.flushEvents();
    assert.equal(attempts, 3, 'the batch must be attempted three times in total');
    assert.equal(ds.savedEventCount, 2, 'a late success persists the batch');
    assert.equal(ds.droppedEventCount, 0, 'a recovered batch is not a drop');
    assert.deepEqual(dropped, []);

    // A batch that exhausts its retries is counted, reported, surfaced.
    stub.restore();
    let permanent = 0;
    EventSchema.insertMany = () => {
      permanent += 1;
      return Promise.reject(new Error('write concern failed'));
    };
    await ds.saveEvent(event(3));
    await ds.flushEvents();
    assert.equal(permanent, 3, 'exactly initial attempt + writeRetries');
    assert.equal(ds.droppedEventCount, 1);
    assert.deepEqual(dropped, [1], 'the onDrop hook must see the dropped batch');
    assert.ok(
      logger.lines.some(
        ([level, first]) => level === 'error' && /Cannot save 1 events/.test(first)
      ),
      'the drop must be reported through the logger'
    );
    assert.equal(ds.pendingEvents.length, 0, 'dropped events leave the queue');
  } finally {
    stub.restore();
  }
});

test('stop() drains pending events before closing the client', async () => {
  const logger = fakeLogger();
  const ds = new DataStorage({ protocol: 'MONGODB', connConfig: {} }, logger, {
    maxBatchSize: 100,
    flushIntervalMs: 60000,
  });
  const order = [];
  ds.dsClient = { close: () => order.push('closed') };
  const stub = stubInsertMany(null);
  try {
    await ds.saveEvent(event(1));
    await ds.saveEvent(event(2));
    ds.stop(() => order.push('callback'));
    assert.deepEqual(order, [], 'stop must not close synchronously');
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(order, ['closed', 'callback'], 'the drain precedes the close');
    assert.equal(stub.calls.length, 1, 'the pending batch was written on stop');
    assert.equal(stub.calls[0].docs.length, 2);
    assert.equal(ds.pendingEvents.length, 0);
  } finally {
    stub.restore();
  }
});

test('stop() closes even when the drain fails, after reporting the drop', async () => {
  const logger = fakeLogger();
  const ds = new DataStorage({ protocol: 'MONGODB', connConfig: {} }, logger, {
    maxBatchSize: 100,
    flushIntervalMs: 60000,
    writeRetries: 0,
  });
  const order = [];
  const stub = stubInsertMany(() => Promise.reject(new Error('gone')));
  try {
    await ds.saveEvent(event(1));
    ds.stop(() => order.push('closed'));
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(order, ['closed'], 'shutdown completes despite a failed batch');
    assert.equal(ds.droppedEventCount, 1);
    assert.ok(logger.lines.some(([level]) => level === 'error'));
  } finally {
    stub.restore();
  }
});
