// DataStorage wiring tests (issue #80).
//
// Replaces src/core/communications/DataStorage.test.js - an ad-hoc script
// that opened a live localhost:27017 MongoDB and printed results, and was
// never run by `npm test`. The behaviour worth keeping - how DataStorage
// builds its ENACTDB client, reports unsupported protocols, propagates
// connection failures, defaults query time bounds, and tears the client
// down - is pinned here with in-process stubs only, following the same
// pattern as test/mongoose-migration.test.js and
// test/db-connector-credential-redaction.test.js. No live database needed.
const test = require('node:test');
const assert = require('node:assert/strict');

const DataStorage = require('../src/core/communications/DataStorage');
const enact = require('../src/core/enact-mongoose');
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

// Intercept ENACTDB.prototype.connect so no socket is ever opened. Every
// construction DataStorage performs is recorded, and `impl` answers the
// callback.
function stubEnactConnect(impl) {
  const original = enact.ENACTDB.prototype.connect;
  const built = [];
  enact.ENACTDB.prototype.connect = function (callback) {
    built.push({ host: this.host, port: this.port, dbName: this.dbName, auth: this.auth });
    return impl.call(this, callback);
  };
  return {
    built,
    restore: () => {
      enact.ENACTDB.prototype.connect = original;
    },
  };
}

test('connect wires host, port, database and credentials into the client', async () => {
  const logger = fakeLogger();
  const ds = new DataStorage(
    {
      protocol: 'MONGODB',
      connConfig: {
        host: 'db.internal',
        port: 27017,
        dbname: 'homeiodb',
        username: 'writer',
        password: 'secret',
      },
    },
    logger
  );
  const stub = stubEnactConnect(function (callback) {
    callback(null);
  });
  try {
    await new Promise((resolve) => ds.connect(() => resolve()));
    assert.equal(stub.built.length, 1);
    assert.deepEqual(stub.built[0], {
      host: 'db.internal',
      port: 27017,
      dbName: 'homeiodb',
      auth: { username: 'writer', password: 'secret' },
    });
    assert.ok(ds.dsClient instanceof enact.ENACTDB, 'the client must be stored for stop()');
    assert.ok(
      logger.lines.some(([level, first]) => level === 'log' && /Connected to database/.test(first)),
      'a successful connect must be logged'
    );
  } finally {
    stub.restore();
  }
});

test('connect without credentials builds an unauthenticated client', async () => {
  const ds = new DataStorage({
    protocol: 'MONGODB',
    connConfig: { host: 'localhost', port: 27017, dbname: 'tasdb' },
  });
  const stub = stubEnactConnect(function (callback) {
    callback(null);
  });
  try {
    await new Promise((resolve) => ds.connect(() => resolve()));
    assert.equal(stub.built[0].auth, null);
    assert.equal(stub.built[0].dbName, 'tasdb');
  } finally {
    stub.restore();
  }
});

test('an unsupported protocol is reported, never connects, and never calls back', async () => {
  const logger = fakeLogger();
  const ds = new DataStorage(
    { protocol: 'COUCHDB', connConfig: { host: 'localhost', port: 5984 } },
    logger
  );
  let connected = false;
  const stub = stubEnactConnect(function () {
    connected = true;
  });
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(resolve, 50);
      ds.connect(() => {
        clearTimeout(timer);
        reject(new Error('the callback must not be invoked for an unsupported protocol'));
      });
    });
    assert.equal(ds.dsClient, null, 'no client may be built for an unsupported protocol');
    assert.equal(connected, false);
    assert.ok(
      logger.lines.some(
        ([level, first]) => level === 'log' && /Unsupported protocol: COUCHDB/.test(first)
      ),
      'the unsupported protocol must be reported'
    );
  } finally {
    stub.restore();
  }
});

test('a failed connection reaches the connect callback unchanged', async () => {
  const logger = fakeLogger();
  const ds = new DataStorage(
    { protocol: 'MONGODB', connConfig: { host: 'localhost', port: 27017, dbname: 'homeiodb' } },
    logger
  );
  const failure = new Error('connect ECONNREFUSED 127.0.0.1:27017');
  const stub = stubEnactConnect(function (callback) {
    callback(failure);
  });
  try {
    await new Promise((resolve, reject) => {
      ds.connect((err) => (err === failure ? resolve() : reject(new Error('wrong error'))));
    });
    assert.ok(
      logger.lines.some(([level, first]) => level === 'error' && /Failed to connect/.test(first)),
      'the failure must be logged'
    );
  } finally {
    stub.restore();
  }
});

test('getEvents defaults open time bounds and forwards topic and datasetId', async () => {
  const ds = new DataStorage({ protocol: 'MONGODB', connConfig: {} }, fakeLogger());
  const originalFind = EventSchema.findEventsBetweenTimes;
  const calls = [];
  EventSchema.findEventsBetweenTimes = (filter, startTime, endTime) => {
    calls.push({ filter, startTime, endTime });
    return Promise.resolve([]);
  };
  try {
    const before = Date.now();
    await new Promise((resolve) =>
      ds.getEvents('enact/sensors/cec/status', 'homeio-dataset-01', {}, () => resolve())
    );
    const after = Date.now();

    assert.deepEqual(calls[0].filter, {
      topic: 'enact/sensors/cec/status',
      datasetId: 'homeio-dataset-01',
    });
    assert.equal(calls[0].startTime, 0, 'a missing startTime must default to the epoch');
    assert.ok(
      calls[0].endTime >= before && calls[0].endTime <= after,
      'a missing endTime must default to now'
    );

    await new Promise((resolve) =>
      ds.getEvents('t/1', 'ds-1', { startTime: 100, endTime: 200 }, () => resolve())
    );
    assert.deepEqual(calls[1], {
      filter: { topic: 't/1', datasetId: 'ds-1' },
      startTime: 100,
      endTime: 200,
    });
  } finally {
    EventSchema.findEventsBetweenTimes = originalFind;
  }
});

test('stop() closes the client once and tolerates never having connected', async () => {
  const ds = new DataStorage({ protocol: 'MONGODB', connConfig: {} }, fakeLogger());
  const originalClose = enact.ENACTDB.prototype.close;
  let closes = 0;
  enact.ENACTDB.prototype.close = function (callback) {
    closes++;
    if (typeof callback === 'function') callback(null);
  };

  // Never connected: stop must be a harmless no-op.
  ds.stop();
  assert.equal(closes, 0);

  const stub = stubEnactConnect(function (callback) {
    callback(null);
  });
  try {
    await new Promise((resolve) => ds.connect(() => resolve()));
    ds.stop();
    assert.equal(closes, 1, 'a connected client must be closed exactly once by stop()');
  } finally {
    enact.ENACTDB.prototype.close = originalClose;
    stub.restore();
  }
});
