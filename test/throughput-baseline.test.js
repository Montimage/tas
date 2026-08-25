/**
 * Throughput-baseline gate for the Phase 4 milestone (issue #33).
 *
 * Asserts the migrated stack's hot paths still meet or exceed their
 * pre-migration baselines, using the very machinery the recorded numbers in
 * BENCHMARKS.md come from (`scripts/benchmark-scoring.js`, now exported):
 *
 *   - Report scoring: the current `evaluate` must not be slower than the
 *     preserved pre-#31 greedy scan-and-splice on IDENTICAL input — a direct,
 *     machine-fair "meets or exceeds the baseline" comparison. The recorded
 *     gap is 50x-130x; timing noise cannot flip a requirement of parity.
 *   - Event writes: the batched write path must keep its documented shape —
 *     a 5,000-event burst issues at most one `insertMany` per batch size plus
 *     the drain, where the unbatched baseline opens exactly one call per
 *     event. This is structural, so it holds on any hardware.
 *
 * Sized to stay well under a couple of seconds: the quadratic baseline is
 * what makes scoring slow, and it is capped accordingly.
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const { performance } = require('node:perf_hooks');

const { makeEvents, legacyCompareArray, benchWrites } = require('../scripts/benchmark-scoring');
const { evaluate, ALL_EVENTS, METRIC_VALUE } = require('../src/core/evaluation');

/** Best-of-runs wall time, in ms — friendliest reading for the baseline side. */
const bestOf = (fn, runs) => {
  let best = Infinity;
  for (let index = 0; index < runs; index++) {
    const start = performance.now();
    fn();
    const elapsed = performance.now() - start;
    if (elapsed < best) best = elapsed;
  }
  return best;
};

test('report scoring is no slower than the pre-migration algorithm on identical input', () => {
  const count = 4000;
  const originalEvents = makeEvents(count, Math.max(2, Math.floor(count / 50)), 1);
  const newEvents = makeEvents(count, Math.max(2, Math.floor(count / 50)), 7);
  const originalValues = originalEvents.map((event) => event.values);
  const newValues = newEvents.map((event) => event.values);

  // Three runs each, best-of against best-of: noise works in the baseline's
  // favour, so parity-or-better stays an honest requirement.
  const legacyBest = bestOf(() => legacyCompareArray(originalValues, newValues), 3);
  const currentBest = bestOf(
    () => evaluate(originalEvents, newEvents, ALL_EVENTS, METRIC_VALUE),
    3
  );

  assert.ok(
    currentBest <= legacyBest,
    `the migrated scorer took ${currentBest.toFixed(1)}ms against the ` +
      `pre-migration baseline's ${legacyBest.toFixed(1)}ms on ${count} events`
  );
});

test('scoring 4,000 events completes within the suite budget', () => {
  const count = 4000;
  const originalEvents = makeEvents(count, Math.max(2, Math.floor(count / 50)), 1);
  const newEvents = makeEvents(count, Math.max(2, Math.floor(count / 50)), 7);
  // Generous absolute guard so a pathological environment fails loudly here
  // rather than tripping the whole-suite timeout: the linear implementation
  // answers in single-digit milliseconds on commodity hardware.
  const elapsed = bestOf(
    () => void evaluate(originalEvents, newEvents, ALL_EVENTS, METRIC_VALUE),
    1
  );
  assert.ok(elapsed < 2000, 'scoring must stay far inside a two-second ceiling');
});

test('a 5,000-event burst keeps the documented batching shape', async () => {
  const result = await benchWrites(5000, 50);
  assert.equal(result.saved, 5000, 'every event must be saved, none dropped silently');
  assert.ok(
    result.writeCalls <= Math.ceil(5000 / 50) + 1,
    `batching issued ${result.writeCalls} write calls for 5,000 events - the ` +
      'documented shape is one call per full batch plus the drain'
  );
});
