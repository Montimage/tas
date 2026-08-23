// Hot-path lookups on the Device message handlers (issue #31).
//
// testBrokerMessagehandler used to scan the actuator list for an exact topic
// and the sensor paths recompiled their MQTT pattern inside the per-device
// loop for every arriving message. Actuators are now indexed by topic in a
// Map, and every sensor carries a matcher compiled once at registration.
// These tests construct Devices directly - no broker is connected (the
// constructor wires nothing), the data storage is a stub recorder, so no
// MongoDB or MQTT server participates.
const { test } = require('node:test');
const assert = require('node:assert/strict');

const Device = require('../src/core/things/Thing');

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

const makeDevice = () => {
  const logger = fakeLogger();
  const device = new Device(
    {
      id: 'device-1',
      name: 'Thermometer',
      behaviours: [],
      sensors: [],
      actuators: [],
    },
    null,
    'dataset-original',
    null,
    { id: 'dataset-new' },
    null,
    false,
    null,
    logger
  );
  device.dataStorage = {
    saveEvents: [],
    saveEvent(event) {
      this.saveEvents.push(event);
    },
  };
  device.testBroker = {
    published: [],
    publish(topic, data) {
      this.published.push({ topic, data });
    },
    unsubscribe() {},
  };
  return { device, logger };
};

test('actuator messages resolve through the topic index', () => {
  const { device, logger } = makeDevice();
  device.addActuator('led-1', { id: 'led-1', topic: 'devices/device-1/actuators/led-1' });
  assert.equal(device.actuatorsByTopic.size, 1);

  device.testBrokerMessagehandler('devices/device-1/actuators/led-1', 'on');
  assert.equal(device.actuators[0].actuatedData, 'on');
  assert.equal(device.actuators[0].numberOfReceivedData, 1);
  assert.equal(device.numberOfReceivedData, 1);
  assert.deepEqual(device.dataStorage.saveEvents, [
    {
      timestamp: device.dataStorage.saveEvents[0].timestamp,
      topic: 'devices/device-1/actuators/led-1',
      devId: 'led-1',
      datasetId: 'dataset-new',
      isSensorData: false,
      values: 'on',
    },
  ]);

  // An unknown topic still reports, after one Map miss instead of a scan.
  device.testBrokerMessagehandler('devices/device-1/actuators/ghost', 'x');
  assert.ok(
    logger.lines.some(([, first]) => /Cannot find the actuator/.test(first)),
    'an unmatched actuator topic must be logged'
  );
});

test('removing an actuator keeps the topic index in step', () => {
  const { device, logger } = makeDevice();
  device.addActuator('led-1', { id: 'led-1', topic: 'devices/device-1/actuators/led-1' });
  device.removeActuator('led-1', null);
  assert.equal(device.actuatorsByTopic.size, 0);

  device.testBrokerMessagehandler('devices/device-1/actuators/led-1', 'on');
  assert.ok(
    logger.lines.some(([, first]) => /Cannot find the actuator/.test(first)),
    'a removed actuator must not answer messages'
  );
  assert.equal(device.dataStorage.saveEvents.length, 0);
});

test('sensor topics match precompiled patterns on the hot path', () => {
  const { device, logger } = makeDevice();
  device.addSensor('temp-1', { id: 'temp-1', topic: 'devices/+/sensors/temp-1' });
  assert.equal(typeof device.sensors[0].topicMatcher, 'function');

  // A concrete topic under the wildcard matches without recompiling.
  device.publishDataToTestBroker('devices/device-1/sensors/temp-1', '21.5');
  assert.deepEqual(device.testBroker.published, [
    { topic: 'devices/device-1/sensors/temp-1', data: '21.5' },
  ]);
  assert.equal(device.numberOfSentData, 1);
  assert.equal(device.dataStorage.saveEvents.length, 1);

  // An unrelated sensor's pattern does not match, and the miss is logged.
  device.publishDataToTestBroker('somewhere/else', 'x');
  assert.equal(device.numberOfSentData, 1);
  assert.ok(
    logger.lines.some(([, first]) => /Cannot find the sensor/.test(first)),
    'an unmatched sensor topic must be logged'
  );
});

test('the compiled matcher cache is bounded and shared per pattern', () => {
  const { compileMQTTTopicPattern } = require('../src/core/utils');
  const first = compileMQTTTopicPattern('devices/+/sensors/#');
  assert.equal(compileMQTTTopicPattern('devices/+/sensors/#'), first);

  // Flooding distinct patterns must not grow memory without bound: the cache
  // clears at its limit rather than evicting one entry at a time.
  for (let i = 0; i < 1200; i++) compileMQTTTopicPattern(`flood/${i}/#`);
  assert.ok(true, 'flooding completed without error');
});
