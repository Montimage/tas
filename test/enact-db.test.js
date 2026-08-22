// ENACTDB facade tests (issue #80).
//
// Replaces src/core/enact-mongoose/index.test.js - an ad-hoc script that
// opened a live localhost:27017 MongoDB and printed a TestCase, and was
// never run by `npm test`. The behaviour worth keeping around the ENACTDB
// connection facade is pinned here with in-process stubs only. The plain
// success/failure/close paths are already covered by
// test/mongoose-migration.test.js; this suite adds what that one does not:
// the constructor contract, the already-connected short-circuit, credential
// forwarding, and disconnect-failure propagation.
const test = require('node:test');
const assert = require('node:assert/strict');

const mongoose = require('mongoose');
const enact = require('../src/core/enact-mongoose');

test('the constructor records its coordinates and starts disconnected', () => {
  const db = new enact.ENACTDB('localhost', 27017, 'tasdb');
  assert.equal(db.host, 'localhost');
  assert.equal(db.port, 27017);
  assert.equal(db.dbName, 'tasdb');
  assert.equal(db.auth, null);
  assert.equal(db.isConnected, false);
});

test('connect short-circuits when it believes it is already connected', async () => {
  const originalConnect = mongoose.connect;
  let called = 0;
  mongoose.connect = () => {
    called++;
    return Promise.resolve();
  };
  const db = new enact.ENACTDB('localhost', 27017, 'tasdb');
  db.isConnected = true;
  try {
    await new Promise((resolve) => {
      db.connect((err) => {
        // The short-circuit invokes the callback with no arguments, unlike
        // the full path's explicit callback(null) - pinned as-is.
        assert.equal(err, undefined, 'the short-circuit must report success');
        resolve();
      });
    });
    assert.equal(called, 0, 'an already-connected facade must not touch the driver');
    assert.equal(db.isConnected, true);
  } finally {
    mongoose.connect = originalConnect;
  }
});

test('connect forwards credentials as driver auth options', async () => {
  const originalConnect = mongoose.connect;
  const originalReadyState = Object.getOwnPropertyDescriptor(mongoose.connection, 'readyState');
  let seenOptions;
  mongoose.connect = (connString, options) => {
    assert.match(connString, /^mongodb:\/\/localhost:27017$/);
    seenOptions = options;
    Object.defineProperty(mongoose.connection, 'readyState', {
      value: 1,
      configurable: true,
    });
    return Promise.resolve();
  };
  const db = new enact.ENACTDB('localhost', 27017, 'tasdb', {
    username: 'reader',
    password: 'hunter2',
  });
  try {
    await new Promise((resolve) => {
      db.connect((err) => {
        assert.equal(err, null);
        resolve();
      });
    });
    assert.equal(seenOptions.user, 'reader');
    assert.equal(seenOptions.pass, 'hunter2');
    assert.equal(db.isConnected, true);
  } finally {
    mongoose.connect = originalConnect;
    if (originalReadyState) {
      Object.defineProperty(mongoose.connection, 'readyState', originalReadyState);
    } else {
      delete mongoose.connection.readyState;
    }
  }
});

test('close propagates a failed disconnect through its callback', async () => {
  const originalDisconnect = mongoose.disconnect;
  const failure = new Error('disconnect timed out');
  mongoose.disconnect = () => Promise.reject(failure);
  const db = new enact.ENACTDB('localhost', 27017, 'tasdb');
  try {
    await new Promise((resolve, reject) => {
      db.close((err) => (err === failure ? resolve() : reject(new Error('wrong error'))));
    });
  } finally {
    mongoose.disconnect = originalDisconnect;
  }
});

test('the module facade still exposes every schema beside the connector', () => {
  for (const key of [
    'ENACTDB',
    'ReportSchema',
    'SensorSchema',
    'ActuatorSchema',
    'EventSchema',
    'DatasetSchema',
    'TestCaseSchema',
    'TestCampaignSchema',
  ]) {
    assert.ok(enact[key], `${key} must stay exported from enact-mongoose`);
  }
});
