// Linear-time report scoring (issue #31).
//
// compareArray used to run an O(n*m) greedy scan with a splice inside the
// inner loop, and the timestamp metrics paid it on every scored topic. The
// value metric now counts multiset matches through a Map and the timestamp
// metrics sweep sorted intervals with next-unmatched pointers. These tests
// pin three properties: randomized inputs score exactly like the legacy
// quadratic implementation, large inputs complete in bounded time, and the
// quadratic cost is demonstrably gone.
const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  evalulate,
  ALL_EVENTS,
  METRIC_VALUE,
  THRESHOLD_FLEXIBLE,
} = require('../src/core/evaluation');

// The legacy quadratic implementation, verbatim in behavior: this is the
// "before" side of both the equivalence check and the benchmark below.
const legacyCompareArray = (originalArray, newArray) => {
  const originalArrays = [...originalArray];
  const newArrays = [...newArray];
  const originalLen = originalArray.length;
  const newLen = newArray.length;
  let newArrayRemain = [];
  for (let index = 0; index < newArrays.length; index++) {
    const nV = newArrays[index];
    let found = false;
    for (let index2 = 0; index2 < originalArrays.length; index2++) {
      if (JSON.stringify(originalArrays[index2]) === JSON.stringify(nV)) {
        found = true;
        originalArrays.splice(index2, 1);
        break;
      }
    }
    if (!found) newArrayRemain.push(nV);
  }
  if (newArrayRemain.length === 0) {
    const remainingOriginals = originalArrays.length;
    if (remainingOriginals === 0) return 1;
    return (originalLen - remainingOriginals) / originalLen;
  }
  const remainingOriginals = originalArrays.length;
  if (remainingOriginals === 0) return (newLen - newArrayRemain.length) / newLen;
  return (
    (((originalLen - remainingOriginals) / originalLen) * (newLen - newArrayRemain.length)) / newLen
  );
};

const ev = (topic, values, timestamp, isSensorData = true) => ({
  topic,
  values,
  timestamp,
  isSensorData,
});

test('randomized value-metric topics score exactly like the legacy scan', () => {
  // Deterministic LCG so a failure is reproducible from this seed alone.
  let seed = 20260823;
  const rand = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;

  for (let trial = 0; trial < 200; trial++) {
    const originalValues = Array.from({ length: Math.floor(rand() * 40) }, () =>
      Math.floor(rand() * 20)
    );
    const newValues = Array.from({ length: Math.floor(rand() * 40) }, () =>
      Math.floor(rand() * 20)
    );

    // evaluateEvents maps a topic onto 1 when its score clears the flexible
    // threshold and to 0 otherwise; mirror that mapping here.
    const topicScore = legacyCompareArray(originalValues, newValues);
    const expectedScore = topicScore >= THRESHOLD_FLEXIBLE ? 1 : 0;

    const originalEvents = originalValues.map((v, i) => ev('t', [v], i));
    const newEvents = newValues.map((v, i) => ev('t', [v], i));
    const freshScore = evalulate(originalEvents, newEvents, ALL_EVENTS, METRIC_VALUE);
    assert.equal(freshScore, expectedScore, `trial ${trial}: legacy topic score ${topicScore}`);
  }
});

test('a large identical run scores perfectly in bounded time', () => {
  const count = 40000;
  const mk = (offset) =>
    Array.from({ length: count }, (_, i) => ev(`t/${i % 50}`, [i], offset + i * 10));
  const originalEvents = mk(1000000000000);
  const newEvents = mk(1000000000000);

  const start = process.hrtime.bigint();
  const score = evalulate(originalEvents, newEvents, ALL_EVENTS, METRIC_VALUE);
  const elapsedMs = Number(process.hrtime.bigint() - start) / 1e6;
  assert.equal(score, 1);
  assert.ok(
    elapsedMs < 5000,
    `scoring ${count}+${count} events must stay far under the old quadratic cost (${elapsedMs.toFixed(
      0
    )}ms)`
  );
});

test('the quadratic cost of the legacy scan is demonstrably gone', { timeout: 60000 }, () => {
  // Disjoint sets are the worst case for the old loop: every new value
  // scans every remaining original. 4000x4000 means ~16M JSON comparisons.
  const count = 4000;
  const originalValues = Array.from({ length: count }, (_, i) => [i]);
  const newValues = Array.from({ length: count }, (_, i) => [-i]);

  const legacyStart = process.hrtime.bigint();
  const legacyTopicScore = legacyCompareArray(originalValues, newValues);
  const legacyMs = Number(process.hrtime.bigint() - legacyStart) / 1e6;

  const originalEvents = originalValues.map((v, i) => ev('t', v, i));
  const newEvents = newValues.map((v, i) => ev('t', v, i));
  const freshStart = process.hrtime.bigint();
  const freshScore = evalulate(originalEvents, newEvents, ALL_EVENTS, METRIC_VALUE);
  const freshMs = Number(process.hrtime.bigint() - freshStart) / 1e6;

  assert.equal(legacyTopicScore >= THRESHOLD_FLEXIBLE, false);
  assert.equal(freshScore, 0);
  assert.ok(
    freshMs * 20 < legacyMs,
    `the rewrite must beat the quadratic scan by an order of magnitude (legacy ${legacyMs.toFixed(
      0
    )}ms vs fresh ${freshMs.toFixed(1)}ms)`
  );
});
