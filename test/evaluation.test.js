// Evaluation scoring tests (issue #23, acceptance criterion 3).
//
// Moved here from src/core/evaluation/index.test.js by issue #80 so the
// `npm test` glob (test/**/*.test.js) actually runs it.
//
// The evaluation module is pure logic: evalulate(originalEvents, newEvents,
// eventType, metricType, threshold) returns a similarity score in [0, 1] (or
// null for an unsupported event type, -1 for an unsupported metric). These
// tests exercise known input/output pairs, including the empty, identical,
// disjoint and partially-overlapping event sets the issue calls out, and run
// with no database or message broker.
const test = require('node:test');
const assert = require('node:assert/strict');

const evalMod = require('../src/core/evaluation');
const {
  evalulate,
  THRESHOLD_FLEXIBLE,
  THRESHOLD_NORMAL,
  THRESHOLD_STRICT,
  ALL_EVENTS,
  SENSOR_EVENTS,
  ACTUATOR_EVENTS,
  METRIC_VALUE,
  METRIC_VALUE_TIMESTAMP,
} = evalMod;

// Build a minimal event list. isSensorData distinguishes sensor vs actuator.
const ev = (topic, values, timestamp, isSensorData = true) => ({
  topic,
  values,
  timestamp,
  isSensorData,
});

test('identical event sets score 1.0 (value metric)', () => {
  const original = [ev('t/1', [1], 100), ev('t/2', [2], 200)];
  const fresh = [ev('t/1', [1], 100), ev('t/2', [2], 200)];
  // Value metric ignores timestamps, so identical values score 1.
  const score = evalulate(original, fresh, ALL_EVENTS, METRIC_VALUE, THRESHOLD_FLEXIBLE);
  assert.equal(score, 1);
});

test('value+timestamp metric: identical values with first-event baseline zero scores 0 (known quirk)', () => {
  // evalEventValueTimestamp shifts every timestamp by timestamps[0], so the
  // first event lands at 0; compareDelayTimestamp then divides by t1 === 0 and
  // yields NaN, so the match fails. Documented here so a later fix is caught.
  const original = [ev('t/1', [1], 100), ev('t/1', [2], 200)];
  const fresh = [ev('t/1', [1], 100), ev('t/1', [2], 200)];
  const score = evalulate(original, fresh, ALL_EVENTS, METRIC_VALUE_TIMESTAMP, THRESHOLD_FLEXIBLE);
  assert.equal(score, 0);
});

test('empty original and empty new score 1.0 (no false regression)', () => {
  assert.equal(evalulate([], [], ALL_EVENTS, METRIC_VALUE, THRESHOLD_FLEXIBLE), 1);
});

test('empty original, non-empty new scores 0 (nothing matched)', () => {
  const fresh = [ev('t/1', [1], 100)];
  // evaluateEvents: new has items, original empty -> newArrayRemain = all -> 0
  const score = evalulate([], fresh, ALL_EVENTS, METRIC_VALUE, THRESHOLD_FLEXIBLE);
  assert.equal(score, 0);
});

test('disjoint event sets score 0 (no topic overlap)', () => {
  const original = [ev('a/1', [1], 100), ev('a/2', [2], 200)];
  const fresh = [ev('b/1', [9], 100), ev('b/2', [8], 200)];
  const score = evalulate(original, fresh, ALL_EVENTS, METRIC_VALUE, THRESHOLD_FLEXIBLE);
  assert.equal(score, 0);
});

test('a topic with an unmatched new value scores 0 (no partial credit)', () => {
  // original has 2 values [1,2]; new has [1,3] -> value 3 never matches an
  // original, so newArrayRemain is non-empty and the topic scores 0.
  const original = [ev('t/1', [1], 100), ev('t/1', [2], 200)];
  const fresh = [ev('t/1', [1], 100), ev('t/1', [3], 200)];
  const score = evalulate(original, fresh, ALL_EVENTS, METRIC_VALUE, THRESHOLD_FLEXIBLE);
  assert.equal(score, 0);
});

test('a topic that is a value-subset of original is dropped by the normal threshold', () => {
  // new is a 1-of-2 subset -> the topic scores 0.5. Flexible (0.5) keeps it
  // (1/1); normal (0.75) drops it (0/1).
  const original = [ev('t/1', [1], 100), ev('t/1', [2], 200)];
  const fresh = [ev('t/1', [1], 100)];
  const flexible = evalulate(original, fresh, ALL_EVENTS, METRIC_VALUE, THRESHOLD_FLEXIBLE);
  const normal = evalulate(original, fresh, ALL_EVENTS, METRIC_VALUE, THRESHOLD_NORMAL);
  assert.equal(flexible, 1); // 0.5 >= 0.5
  assert.equal(normal, 0); // 0.5 < 0.75
});

test('SENSOR_EVENTS only scores sensor events', () => {
  const original = [
    ev('s/1', [1], 100, true), // sensor
    ev('a/1', [1], 100, false), // actuator
  ];
  const fresh = [
    ev('s/1', [1], 100, true),
    ev('a/1', [9], 100, false), // actuator differs, must be ignored
  ];
  const score = evalulate(original, fresh, SENSOR_EVENTS, METRIC_VALUE, THRESHOLD_FLEXIBLE);
  assert.equal(score, 1);
});

test('ACTUATOR_EVENTS only scores actuator events', () => {
  const original = [ev('s/1', [1], 100, true), ev('a/1', [1], 100, false)];
  const fresh = [
    ev('s/1', [9], 100, true), // sensor differs, must be ignored
    ev('a/1', [1], 100, false),
  ];
  const score = evalulate(original, fresh, ACTUATOR_EVENTS, METRIC_VALUE, THRESHOLD_FLEXIBLE);
  assert.equal(score, 1);
});

test('value metric ignores timestamp skew', () => {
  const original = [ev('t/1', [5], 100)];
  const fresh = [ev('t/1', [5], 999999)]; // wildly different timestamp, same value
  const score = evalulate(original, fresh, ALL_EVENTS, METRIC_VALUE, THRESHOLD_FLEXIBLE);
  assert.equal(score, 1);
});

test('value+timestamp metric drops when values match but timestamps skew', () => {
  const original = [ev('t/1', [5], 1000)];
  const fresh = [ev('t/1', [5], 2000)]; // same value, 100% timestamp delta (>= 1% threshold)
  const score = evalulate(original, fresh, ALL_EVENTS, METRIC_VALUE_TIMESTAMP, THRESHOLD_FLEXIBLE);
  assert.equal(score, 0);
});

test('threshold filters weak matches from the score', () => {
  // One topic where new is a 3-of-5 subset of original -> compareArray scores
  // (5-2)/5 = 0.6. Flexible (0.5) keeps it; strict (1.0) drops it.
  const original = [
    ev('t/1', [1], 100),
    ev('t/1', [2], 200),
    ev('t/1', [3], 300),
    ev('t/1', [4], 400),
    ev('t/1', [5], 500),
  ];
  const fresh = [ev('t/1', [1], 100), ev('t/1', [2], 200), ev('t/1', [3], 300)];
  const flexible = evalulate(original, fresh, ALL_EVENTS, METRIC_VALUE, THRESHOLD_FLEXIBLE);
  const strict = evalulate(original, fresh, ALL_EVENTS, METRIC_VALUE, THRESHOLD_STRICT);
  assert.equal(flexible, 1); // the 0.6 topic passes the 0.5 threshold -> 1/1
  assert.equal(strict, 0); // the 0.6 topic fails the 1.0 threshold -> 0/1
});

test('unsupported metric type returns -1', () => {
  const original = [ev('t/1', [1], 100)];
  const fresh = [ev('t/1', [1], 100)];
  const score = evalulate(original, fresh, ALL_EVENTS, 'NOT_A_METRIC', THRESHOLD_FLEXIBLE);
  assert.equal(score, -1);
});

test('unsupported event type returns null', () => {
  const original = [ev('t/1', [1], 100)];
  const fresh = [ev('t/1', [1], 100)];
  const score = evalulate(original, fresh, 'NOT_AN_EVENT_TYPE', METRIC_VALUE, THRESHOLD_FLEXIBLE);
  assert.equal(score, null);
});

test('threshold constants are ordered flexible < normal < strict', () => {
  assert.ok(THRESHOLD_FLEXIBLE < THRESHOLD_NORMAL);
  assert.ok(THRESHOLD_NORMAL < THRESHOLD_STRICT);
  assert.equal(THRESHOLD_STRICT, 1.0);
});
