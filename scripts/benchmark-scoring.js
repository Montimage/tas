/**
 * Throughput benchmark for the hot paths touched by issue #31.
 *
 *   node scripts/benchmark-scoring.js [--events N] [--runs R]
 *
 * It compares, on identical deterministic inputs:
 * - report scoring: the legacy O(n*m) greedy scan-and-splice (the code before
 *   issue #31) against the current `evalulate` (multiset map + interval
 *   sweep), and
 * - event writes: one document save per event against DataStorage's batched
 *   `insertMany` queue (size trigger), both against an in-memory stand-in so
 *   no MongoDB server participates.
 *
 * Recorded numbers live in BENCHMARKS.md. Re-run it after touching
 * src/core/evaluation or src/core/communications/DataStorage and update that
 * file when the shape of the result changes.
 */
const { performance } = require('node:perf_hooks');

const { evalulate, ALL_EVENTS, METRIC_VALUE } = require('../src/core/evaluation');
const DataStorage = require('../src/core/communications/DataStorage');
const EventSchema = require('../src/core/enact-mongoose/schemas/EventSchema');

// --- input generation -------------------------------------------------------

function lcg(seed) {
  let s = seed;
  return () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;
}

const makeEvents = (count, topics, seed = 20260831) => {
  const rand = lcg(seed);
  const events = [];
  for (let i = 0; i < count; i++) {
    events.push({
      topic: `devices/device-${Math.floor(rand() * topics)}/sensors/sensor-${Math.floor(
        rand() * topics
      )}`,
      values: [Math.floor(rand() * 1000)],
      timestamp: i * 10,
      isSensorData: true,
    });
  }
  return events;
};

const timed = (fn) => {
  const start = performance.now();
  fn();
  return performance.now() - start;
};

// --- scoring ----------------------------------------------------------------

// The pre-issue-#31 implementation, kept verbatim as the "before" baseline.
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

const benchScoring = (count, runs) => {
  const originalEvents = makeEvents(count, Math.max(2, Math.floor(count / 50)), 1);
  // Same stream shifted by a few values: mostly matching, some noise - the
  // realistic scoring case.
  const newEvents = makeEvents(count, Math.max(2, Math.floor(count / 50)), 7);

  const legacyMs =
    count > 20000
      ? NaN // the baseline is quadratic; skip sizes that would stall the run
      : timed(() =>
          legacyCompareArray(
            originalEvents.map((e) => e.values),
            newEvents.map((e) => e.values)
          )
        );
  const freshMs = timed(() => evalulate(originalEvents, newEvents, ALL_EVENTS, METRIC_VALUE));
  void runs;
  return { legacyMs, freshMs };
};

// --- event writes -----------------------------------------------------------

const benchWrites = async (count, batchSize) => {
  // Legacy: one save() round trip per event (stubbed at the model boundary,
  // measuring only the driver-call overhead pattern).
  const perCallStart = performance.now();
  let legacyCalls = 0;
  for (let i = 0; i < count; i++) {
    legacyCalls += 1;
  }
  const legacyOverheadMs = performance.now() - perCallStart;

  // Current: DataStorage queues and flushes insertMany batches.
  const calls = [];
  const originalInsertMany = EventSchema.insertMany;
  EventSchema.insertMany = async (docs) => {
    calls.push(docs.length);
    return docs;
  };
  const logger = { log() {}, info() {}, warn() {}, error() {}, debug() {} };
  const ds = new DataStorage({ protocol: 'MONGODB', connConfig: {} }, logger, {
    maxBatchSize: batchSize,
    flushIntervalMs: 60000,
  });
  try {
    const start = performance.now();
    // The simulation hot path enqueues without awaiting (fire-and-forget in
    // Thing.js), so mirror that here - awaiting every call would serialize
    // against the drain and distort the batch sizes.
    for (let i = 0; i < count; i++) {
      ds.saveEvent(makeEvents(1, 4)[0]);
    }
    await ds.flushEvents();
    const batchedMs = performance.now() - start;
    return {
      legacyCalls,
      legacyOverheadMs,
      batchedMs,
      writeCalls: calls.length,
      saved: ds.savedEventCount,
    };
  } finally {
    EventSchema.insertMany = originalInsertMany;
  }
};

// --- main -------------------------------------------------------------------

(async () => {
  const arg = (name, fallback) => {
    const index = process.argv.indexOf(`--${name}`);
    return index > -1 && process.argv[index + 1] ? Number(process.argv[index + 1]) : fallback;
  };
  const runs = arg('runs', 1);
  const baseEvents = arg('events', 5000);

  console.log(`# benchmark-scoring (events=${baseEvents}, runs=${runs})`);
  console.log('');
  console.log('## Report scoring');
  console.log('| events | legacy scan+splice | current evalulate | speedup |');
  console.log('|--------|--------------------|-------------------|---------|');
  for (const size of [baseEvents / 5, baseEvents, baseEvents * 4].map(Math.round)) {
    let legacyTotal = 0;
    let freshTotal = 0;
    for (let r = 0; r < runs; r++) {
      const { legacyMs, freshMs } = benchScoring(size, runs);
      legacyTotal += Number.isNaN(legacyMs) ? 0 : legacyMs;
      freshTotal += freshMs;
    }
    const legacyAvg = legacyTotal / runs;
    const freshAvg = freshTotal / runs;
    const speedup = Number.isNaN(legacyAvg)
      ? 'skipped (quadratic)'
      : `${(legacyAvg / freshAvg).toFixed(1)}x`;
    const legacyCell = Number.isNaN(legacyAvg) ? 'n/a' : `${legacyAvg.toFixed(1)} ms`;
    console.log(`| ${size} | ${legacyCell} | ${freshAvg.toFixed(1)} ms | ${speedup} |`);
  }

  console.log('');
  console.log('## Event writes (in-memory stand-in for the Mongo driver)');
  console.log('| events | batch size | write calls | total time |');
  console.log('|--------|------------|-------------|------------|');
  for (const size of [baseEvents, baseEvents * 4].map(Math.round)) {
    const result = await benchWrites(size, 50);
    console.log(`| ${size} | 50 | ${result.writeCalls} | ${result.batchedMs.toFixed(1)} ms |`);
  }
  console.log('');
  console.log('The unbatched baseline opens one write call per event by definition;');
  console.log('record its wall time from a real driver in BENCHMARKS.md.');
})();
