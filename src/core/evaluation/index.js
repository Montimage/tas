/**
 * Evaluation module
 * - Evaluate the simulation result by comparing the original event streams with the simulated event streams
 * There should be many different way to evaluate the result. In this version, we will go one by one
 * - 1: compare events order
 */

// Threshold values
const THRESHOLD_FLEXIBLE = 0.5;
const THRESHOLD_NORMAL = 0.75;
const THRESHOLD_STRICT = 1.0;

// Event types
const ALL_EVENTS = 'ALL_EVENTS';
const SENSOR_EVENTS = 'SENSOR_EVENTS';
const ACTUATOR_EVENTS = 'ACTUATOR_EVENTS';

// Metrics types
const METRIC_VALUE = 'METRIC_VALUE';
const METRIC_TIMESTAMP = 'METRIC_TIMESTAMP';
const METRIC_VALUE_TIMESTAMP = 'METRIC_VALUE_TIMESTAMP';

// The timestamp metrics' tolerance: a relative skew under 1% still counts as
// a match (|new - t1| / t1 < TOLERANCE, t1 the ORIGINAL timestamp).
const TIMESTAMP_TOLERANCE = 0.01;

const simpleCompare = (v1, v2) => {
  return JSON.stringify(v1) === JSON.stringify(v2);
};

/**
 * Count how many of `newValues` find a partner in `originals` under an exact
 * (equality) comparison (issue #31).
 *
 * This replaces the quadratic scan-and-splice: every original value is
 * bucketed once by its JSON key, then each new value consumes one bucket
 * entry. O(oLen + nLen) time, O(oLen) memory, and exactly the multiset
 * intersection cardinality the greedy first-match loop produced - equal
 * values are interchangeable, so which copy matched never mattered.
 * @param {Array} originalValues The original values
 * @param {Array} newValues The new values
 * @returns {Number} The number of matched new values
 */
const countExactMatches = (originalValues, newValues) => {
  const counts = new Map();
  for (let index = 0; index < originalValues.length; index++) {
    const key = JSON.stringify(originalValues[index]);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  let matched = 0;
  for (let index = 0; index < newValues.length; index++) {
    const key = JSON.stringify(newValues[index]);
    const remaining = counts.get(key) || 0;
    if (remaining > 0) {
      counts.set(key, remaining - 1);
      matched += 1;
    }
  }
  return matched;
};

/**
 * Turn a match count into the score compareArray used to produce.
 *
 * The historical formulas were asymmetric between "every new value found a
 * partner" and "some new values were left over"; they are reproduced here so
 * the linear rewrite scores exactly like the quadratic original.
 * @param {Number} originalLen Size of the original array
 * @param {Number} newLen Size of the new array
 * @param {Number} matched How many new values found a partner
 */
const scoreFromMatchCount = (originalLen, newLen, matched) => {
  if (matched === newLen) {
    return matched === originalLen ? 1 : matched / originalLen;
  }
  return matched === originalLen ? matched / newLen : (matched / originalLen) * (matched / newLen);
};

/**
 * Compare two array
 *
 * Exact comparisons (the default) count matches with a multiset map; a custom
 * comparison function falls back to the historical greedy first-match sweep,
 * which is still quadratic but now splices nothing - removal swaps against
 * the tail, so the inner loop stays allocation-free. The timestamp metrics
 * pass their own numeric comparator through `countDelayMatches`, keeping the
 * hot scoring path linear (issue #31).
 * @param {Array} originalArray The original values
 * @param {Array} newArray The new values
 */
const compareArray = (originalArray, newArray, compareFunction = simpleCompare) => {
  if (!originalArray || !newArray) throw Error('[compareArray] Invalid input!');
  if (compareFunction === simpleCompare) {
    return scoreFromMatchCount(
      originalArray.length,
      newArray.length,
      countExactMatches(originalArray, newArray)
    );
  }

  const originalArrays = [...originalArray];
  const newArrays = [...newArray];
  const originalLen = originalArray.length;
  const newLen = newArray.length;
  let liveLength = originalArrays.length;
  let newArrayRemainCount = 0;
  for (let index = 0; index < newArrays.length; index++) {
    const nV = newArrays[index];
    let found = false;
    for (let index2 = 0; index2 < liveLength; index2++) {
      const oV = originalArrays[index2];
      if (compareFunction(oV, nV)) {
        found = true;
        // Swap-remove keeps the remaining candidates contiguous without the
        // O(n) memmove of splice inside the inner loop.
        liveLength -= 1;
        originalArrays[index2] = originalArrays[liveLength];
        break;
      }
    }
    if (!found) {
      newArrayRemainCount += 1;
    }
  }
  return scoreFromMatchCount(originalLen, newLen, newLen - newArrayRemainCount);
};

/**
 * Count near-matching timestamps in near-linear time (issue #31).
 *
 * |new - t1| / t1 < tolerance holds exactly when
 * t1 > new / (1 + tolerance) and t1 < new / (1 - tolerance), so for each new
 * value the eligible originals form one interval over the sorted originals.
 * Walking both arrays in ascending order with a disjoint-set "next
 * unmatched" pointer visits each original a constant amortised number of
 * times: no O(n*m) pairwise scan, no per-match splice.
 * @param {Array} originalTimestamps Original timestamps (already baselined)
 * @param {Array} newTimestamps New timestamps (already baselined)
 * @returns {Number} The number of matched new timestamps
 */
const countDelayMatches = (originalTimestamps, newTimestamps) => {
  const tolerance = TIMESTAMP_TOLERANCE;
  const originals = [...originalTimestamps].sort((a, b) => a - b);
  const news = [...newTimestamps].sort((a, b) => a - b);
  const n = originals.length;
  // nextUnmatched[i]: the smallest j >= i whose original is still available,
  // with path compression - union-find over indices.
  const nextUnmatched = new Int32Array(n + 1);
  for (let i = 0; i <= n; i++) nextUnmatched[i] = i;
  const findNext = (i) => {
    let root = i;
    while (nextUnmatched[root] !== root) root = nextUnmatched[root];
    while (nextUnmatched[i] !== root) {
      const next = nextUnmatched[i];
      nextUnmatched[i] = root;
      i = next;
    }
    return root;
  };

  let matched = 0;
  let lowIndex = 0;
  for (let index = 0; index < news.length; index++) {
    const tNew = news[index];
    // Eligible originals: (tNew / (1 + tolerance), tNew / (1 - tolerance)).
    // Non-positive originals make the ratio NaN (or negative), which never
    // matched historically either.
    while (
      lowIndex < n &&
      !(originals[lowIndex] > 0 && originals[lowIndex] > tNew / (1 + tolerance))
    ) {
      lowIndex += 1;
    }
    const upperBound = tNew / (1 - tolerance);
    let candidate = findNext(lowIndex);
    if (candidate < n && originals[candidate] > 0 && originals[candidate] < upperBound) {
      matched += 1;
      nextUnmatched[candidate] = candidate + 1;
    }
  }
  return matched;
};

const evalEventValue = (data) => {
  const { originalEvents, newEvents } = data;
  const originalValues = originalEvents.values;
  const newValues = newEvents.values;
  return compareArray(originalValues, newValues);
};

const evalEventTimestamp = (data) => {
  const { originalEvents, newEvents } = data;
  const originalTimestamps = originalEvents.timestamps.map((t) => t - originalEvents.timestamps[0]);
  const newTimestamps = newEvents.timestamps.map((t) => t - newEvents.timestamps[0]);

  return scoreFromMatchCount(
    originalTimestamps.length,
    newTimestamps.length,
    countDelayMatches(originalTimestamps, newTimestamps)
  );
};

const evalEventValueTimestamp = (data) => {
  const { originalEvents, newEvents } = data;
  const originalValues = originalEvents.values;
  const newValues = newEvents.values;
  const originalTimestamps = originalEvents.timestamps.map((t) => t - originalEvents.timestamps[0]);
  const newTimestamps = newEvents.timestamps.map((t) => t - newEvents.timestamps[0]);
  const valueCompare = compareArray(originalValues, newValues);
  const timestampCompare = scoreFromMatchCount(
    originalTimestamps.length,
    newTimestamps.length,
    countDelayMatches(originalTimestamps, newTimestamps)
  );
  return valueCompare * timestampCompare;
};

const evaluateEvents = (originalEvents, newEvents, metricType, threshold) => {
  // console.log(originalEvents, newEvents);
  if (originalEvents.length === 0 && newEvents.length === 0) return 1;
  let topics = {};
  let topicValues = [];
  // Init the list of topics from original events
  for (let index = 0; index < originalEvents.length; index++) {
    const originalE = originalEvents[index];
    const { topic, timestamp, values } = originalE;
    if (topics[topic]) {
      topics[topic].originalEvents.timestamps.push(timestamp);
      topics[topic].originalEvents.values.push(values);
    } else {
      topicValues.push(topic);
      topics[topic] = {
        originalEvents: {
          timestamps: [timestamp],
          values: [values],
        },
        newEvents: {
          timestamps: [],
          values: [],
        },
      };
    }
  }

  // Update the list of topics with new events
  for (let index = 0; index < newEvents.length; index++) {
    const newE = newEvents[index];
    const { topic, timestamp, values } = newE;
    if (topics[topic]) {
      topics[topic].newEvents.timestamps.push(timestamp);
      topics[topic].newEvents.values.push(values);
    } else {
      topicValues.push(topic);
      topics[topic] = {
        originalEvents: {
          timestamps: [],
          values: [],
        },
        newEvents: {
          timestamps: [timestamp],
          values: [values],
        },
      };
    }
  }

  let ret = [];
  // console.log(JSON.stringify(topics));
  let _evalMetric = null;
  switch (metricType) {
    case METRIC_VALUE:
      _evalMetric = (data) => evalEventValue(data);
      break;
    case METRIC_TIMESTAMP:
      _evalMetric = (data) => evalEventTimestamp(data);
      break;
    case METRIC_VALUE_TIMESTAMP:
      _evalMetric = (data) => evalEventValueTimestamp(data);
      break;
    default:
      console.error(`[Evaluation] Unsupported metric type: ${metricType}`);
      return -1;
  }

  for (let index = 0; index < topicValues.length; index++) {
    const topic = topicValues[index];
    const evalTopic = _evalMetric(topics[topic]);
    ret.push(evalTopic);
  }

  const retOK = ret.filter((r) => r >= threshold);
  return retOK.length / ret.length;
};

/**
 * Evaluate the simulation and test
 * @param {Array} originalEvents Array of original events
 * @param {Array} newEvents Array of new events which are generated by simulation
 * @param {String} method The evaluation method
 *  - ALL_EVENT_ORDERING
 *  - ALL_EVENT_ORDERING_WITH_TIMESTAMP
 *  - ACTUATOR_EVENTS_ORDERING
 *  - ACTUATOR_EVENTS_ORDERING_WITH_TIMESTAMP
 * @returns
 * {
 *  score: 60, // percentages of the similarity
 *  evalData: {} // more data on the evaluation
 * }
 */
const evalulate = (
  originalEvents,
  newEvents,
  eventType = ALL_EVENTS,
  metricType = METRIC_VALUE_TIMESTAMP,
  threshold = THRESHOLD_FLEXIBLE
) => {
  switch (eventType) {
    case ALL_EVENTS:
      return evaluateEvents(originalEvents, newEvents, metricType, threshold);
    case SENSOR_EVENTS:
      return evaluateEvents(
        originalEvents.filter((e) => e.isSensorData),
        newEvents.filter((e) => e.isSensorData),
        metricType,
        threshold
      );
    case ACTUATOR_EVENTS:
      return evaluateEvents(
        originalEvents.filter((e) => !e.isSensorData),
        newEvents.filter((e) => !e.isSensorData),
        metricType,
        threshold
      );
    default:
      console.error(`[EVALUATION] Unsupported event type: ${eventType}`);
      return null;
  }
};

module.exports = {
  THRESHOLD_FLEXIBLE,
  THRESHOLD_NORMAL,
  THRESHOLD_STRICT,
  ALL_EVENTS,
  SENSOR_EVENTS,
  ACTUATOR_EVENTS,
  METRIC_VALUE,
  METRIC_TIMESTAMP,
  METRIC_VALUE_TIMESTAMP,
  evalulate,
};
