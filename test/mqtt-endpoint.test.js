// Unit tests for the core MQTT endpoint resolver (issue #45).
//
// The composed deployment points every core client at the broker service via
// TAS_MQTT_HOST / TAS_MQTT_PORT; with both unset the document values pass
// through untouched, so local development and tests behave exactly as before.
const test = require('node:test');
const assert = require('node:assert/strict');

const { resolveMqttEndpoint } = require('../src/core/utils/mqtt-endpoint');

test('passes the document endpoint through when no override is set', () => {
  delete process.env.TAS_MQTT_HOST;
  delete process.env.TAS_MQTT_PORT;
  assert.deepEqual(resolveMqttEndpoint({ host: 'localhost', port: 1884 }), {
    host: 'localhost',
    port: 1884,
  });
});

test('a set TAS_MQTT_HOST overrides the document host', () => {
  process.env.TAS_MQTT_HOST = 'broker';
  try {
    assert.deepEqual(resolveMqttEndpoint({ host: 'localhost', port: 1884 }), {
      host: 'broker',
      port: 1884,
    });
  } finally {
    delete process.env.TAS_MQTT_HOST;
  }
});

test('a set TAS_MQTT_PORT overrides the document port', () => {
  process.env.TAS_MQTT_PORT = '1884';
  try {
    assert.deepEqual(resolveMqttEndpoint({ host: 'localhost', port: 1883 }), {
      host: 'localhost',
      port: '1884',
    });
  } finally {
    delete process.env.TAS_MQTT_PORT;
  }
});

test('both variables override together', () => {
  process.env.TAS_MQTT_HOST = 'broker';
  process.env.TAS_MQTT_PORT = '1884';
  try {
    assert.deepEqual(resolveMqttEndpoint({ HOST: 'ignored', PORT: 'ignored' }).host, 'broker');
    assert.equal(resolveMqttEndpoint({ host: 'localhost', port: 1883 }).port, '1884');
  } finally {
    delete process.env.TAS_MQTT_HOST;
    delete process.env.TAS_MQTT_PORT;
  }
});

test('an empty override value falls back to the document', () => {
  // Compose passes `VAR: ${VAR:-}` for optional values; an empty string must
  // not shadow the document.
  process.env.TAS_MQTT_HOST = '';
  try {
    assert.equal(resolveMqttEndpoint({ host: 'localhost', port: 1884 }).host, 'localhost');
  } finally {
    delete process.env.TAS_MQTT_HOST;
  }
});

test('tolerates a missing or empty config document', () => {
  delete process.env.TAS_MQTT_HOST;
  delete process.env.TAS_MQTT_PORT;
  assert.deepEqual(resolveMqttEndpoint(), { host: undefined, port: undefined });
  assert.deepEqual(resolveMqttEndpoint({}), { host: undefined, port: undefined });
});
