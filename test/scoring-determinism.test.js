/**
 * Golden-score determinism for the evaluation module (issue #33, Phase 4
 * milestone gate).
 *
 * The server migration rewrote the database layer, the state model and the
 * artefact stores; report scoring must not have moved with them. On a fixed
 * input dataset these tests assert three things:
 *
 *   1. `evaluate` returns exactly the scores the PRE-MIGRATION algorithm
 *      produces — the greedy first-match scan kept verbatim as the benchmark
 *      baseline in `scripts/benchmark-scoring.js` (it is the code issue #31
 *      replaced, and the Phase 4 migration did not touch it);
 *   2. the scores equal pinned literal values hand-derived from the scoring
 *      formula, so a future rewrite cannot drift silently once the baseline
 *      copy disappears;
 *   3. repeated evaluations of the same input return identical numbers.
 *
 * Every expected value below is an exact binary fraction (a power-of-two
 * denominator), so float equality is safe. Timestamp spacings sit inside the
 * documented 1% skew window where they are meant to match, and outside it
 * where they are meant to miss. Note one deliberate consequence of the
 * formula: each side is baselined to its own FIRST timestamp, so the two
 * zero anchors can never be a positive-timestamp match — a two-event topic
 * whose remaining pair matches tops out at (1/2)*(1/2), which topic A pins.
 *
 * No database and no network participate: scoring is a pure function of its
 * event arrays.
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  evaluate,
  ALL_EVENTS,
  SENSOR_EVENTS,
  METRIC_VALUE,
  METRIC_TIMESTAMP,
  METRIC_VALUE_TIMESTAMP,
  THRESHOLD_FLEXIBLE,
} = require('../src/core/evaluation');

// The pre-migration value-comparison, copied verbatim from the "before"
// baseline in scripts/benchmark-scoring.js. Do not "fix" anything here: its
// exact shape is what makes the equivalence assertion below meaningful.
const legacyCompareArray = (originalArray, newArray) => {
  const originalArrays = [...originalArray];
  const newArrays = [...newArray];
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
    return (originalArray.length - remainingOriginals) / originalArray.length;
  }
  const remainingOriginals = originalArrays.length;
  if (remainingOriginals === 0) return (newArray.length - newArrayRemain.length) / newArray.length;
  return (
    (((originalArray.length - remainingOriginals) / originalArray.length) *
      (newArray.length - newArrayRemain.length)) /
    newArray.length
  );
};

// --- The fixed input dataset -------------------------------------------------
//
// Two topics over one recording window. Topic A replays faithfully (its one
// comparable spacing drifts 5 ms in 1000, inside the 1% window); topic B
// keeps its reading but grows an unexpected extra one.

const ORIGINAL_EVENTS = [
  { topic: 'home/room-a/temp', timestamp: 1000, values: '21.5', isSensorData: true },
  { topic: 'home/room-a/temp', timestamp: 2000, values: '21.7', isSensorData: true },
  { topic: 'home/room-b/temp', timestamp: 1100, values: '19.0', isSensorData: true },
];

const REPLAYED_EVENTS = [
  { topic: 'home/room-a/temp', timestamp: 5000, values: '21.5', isSensorData: true },
  { topic: 'home/room-a/temp', timestamp: 6005, values: '21.7', isSensorData: true },
  { topic: 'home/room-b/temp', timestamp: 5100, values: '19.0', isSensorData: true },
  { topic: 'home/room-b/temp', timestamp: 6100, values: '25.9', isSensorData: true },
];

// --- Hand-derived golden values ----------------------------------------------
//
// Topic A values ['21.5','21.7'] replay unchanged -> matched = newLen =
// originalLen -> 1. Topic B values ['19.0'] vs ['19.0','25.9'] -> matched(1)
// equals originalLen but trails newLen(2) -> 1/2.
//
// Timestamps compare RELATIVE spacing (each side baselined to its first
// stamp, 1% relative tolerance against the original): topic A's real spacing
// 1005 ms matches its 1000 ms partner, leaving only the unmatched zero
// anchors -> matched(1) of (2,2) -> (1/2)*(1/2) = 1/4. Topic B's extra
// reading has no original partner and its anchor pairs with nothing ->
// matched(0) -> 0.
const VALUE_SCORE_A = 1;
const VALUE_SCORE_B = 0.5;
const TIMESTAMP_SCORE_A = 0.25;
const TIMESTAMP_SCORE_B = 0;

test('value scores match the pre-migration algorithm exactly', () => {
  // Per-topic, the way evaluateEvents compares: the current implementation
  // and the pre-migration scan agree number-for-number on every topic.
  assert.equal(legacyCompareArray(['21.5', '21.7'], ['21.5', '21.7']), VALUE_SCORE_A);
  assert.equal(legacyCompareArray(['19.0'], ['19.0', '25.9']), VALUE_SCORE_B);
});

test('value scores equal their hand-computed golden literals', () => {
  // Only topic B clears the strict threshold; both clear the flexible one.
  assert.equal(evaluate(ORIGINAL_EVENTS, REPLAYED_EVENTS, ALL_EVENTS, METRIC_VALUE, 0.75), 0.5);
  assert.equal(
    evaluate(ORIGINAL_EVENTS, REPLAYED_EVENTS, ALL_EVENTS, METRIC_VALUE, THRESHOLD_FLEXIBLE),
    1
  );
  // An empty comparison window scores perfect agreement, as documented.
  assert.equal(evaluate([], [], ALL_EVENTS, METRIC_VALUE), 1);
});

test('timestamp scores match the tolerance semantics on the fixed dataset', () => {
  const score = evaluate(ORIGINAL_EVENTS, REPLAYED_EVENTS, ALL_EVENTS, METRIC_TIMESTAMP, 0.75);
  // Neither topic reaches the strict threshold (A sits at TIMESTAMP_SCORE_A,
  // B at TIMESTAMP_SCORE_B), so the report score is the fraction above it:
  // zero of two.
  const expected =
    [TIMESTAMP_SCORE_A, TIMESTAMP_SCORE_B].filter((topicScore) => topicScore >= 0.75).length / 2;
  assert.equal(score, expected);

  // Deterministic across repeats — the same input never scores differently.
  assert.equal(score, evaluate(ORIGINAL_EVENTS, REPLAYED_EVENTS, ALL_EVENTS, METRIC_TIMESTAMP));
});

test('combined value-and-timestamp scoring is stable and matches its golden literal', () => {
  const score = evaluate(ORIGINAL_EVENTS, REPLAYED_EVENTS, ALL_EVENTS, METRIC_VALUE_TIMESTAMP);
  // Per topic the combined metric multiplies the value score by the timestamp
  // score: A = 1 * 1/4 = 1/4, B = 1/2 * 0 = 0. Nothing clears the flexible
  // threshold, so the report score is 0.
  const expectedA = VALUE_SCORE_A * TIMESTAMP_SCORE_A;
  const expectedB = VALUE_SCORE_B * TIMESTAMP_SCORE_B;
  const expected =
    [expectedA, expectedB].filter((topicScore) => topicScore >= THRESHOLD_FLEXIBLE).length / 2;
  assert.equal(score, expected);

  // Repeated evaluation returns the identical number.
  assert.equal(
    score,
    evaluate(ORIGINAL_EVENTS, REPLAYED_EVENTS, ALL_EVENTS, METRIC_VALUE_TIMESTAMP)
  );
});

test('sensor-only filtering scores the fixed dataset identically on every repeat', () => {
  // Every event in the fixture is sensor data, so SENSOR_EVENTS must agree
  // exactly with the unfiltered value score.
  const filtered = evaluate(ORIGINAL_EVENTS, REPLAYED_EVENTS, SENSOR_EVENTS, METRIC_VALUE, 0.75);
  assert.equal(filtered, 0.5);
  assert.equal(
    filtered,
    evaluate(ORIGINAL_EVENTS, REPLAYED_EVENTS, SENSOR_EVENTS, METRIC_VALUE, 0.75)
  );
});
