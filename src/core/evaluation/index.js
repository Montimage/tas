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

const simpleCompare = (v1, v2) => {
  return JSON.stringify(v1) === JSON.stringify(v2);
};

/**
 * Compare two array
 * TODO: pass the comparing function to be more flexible
 * @param {Array} originalArray The original values
 * @param {Array} newArray The new values
 */
const compareArray = (
  originalArray,
  newArray,
  compareFunction = simpleCompare
) => {
  if (!originalArray || !newArray) throw Error("[compareArray] Invalid input!");
  if (originalArray.length === 0 && newArray.length === 0) return 1;
  let originalArrays = [...originalArray];
  let newArrays = [...newArray];
  const originalLen = originalArray.length;
  const newLen = newArray.length;
  let newArrayRemain = [];
  for (let index = 0; index < newArrays.length; index++) {
    const nV = newArrays[index];
    let found = false;
    for (let index2 = 0; index2 < originalArrays.length; index2++) {
      const oV = originalArrays[index2];
      if (compareFunction(oV, nV)) {
        found = true;
        originalArrays.splice(index2, 1);
        break;
      }
    }
    if (!found) {
      newArrayRemain.push(nV);
    }
  }

  // Remains 3 cases
  if (newArrayRemain.length === 0) {
    const newOriginalLen = originalArrays.length;
    if (newOriginalLen === 0) return 1;
    return (originalLen - newOriginalLen) / originalLen;
  } else {
    const newOriginalLen = originalArrays.length;
    if (newOriginalLen === 0) return (newLen - newArrayRemain.length) / newLen;
    return (
      (((originalLen - newOriginalLen) / originalLen) *
        (newLen - newArrayRemain.length)) /
      newLen
    );
  }
};

const compareDelayTimestamp = (t1, t2) => {
  if (Math.abs(t2-t1) < 10) return true; // if the different is less than 10ms
  return Math.abs(t2-t1)/t1 < 0.01; // 1% threshold
}

const evalEventValue = (data) => {
  const { originalEvents, newEvents } = data;
  const originalValues = originalEvents.values;
  const newValues = newEvents.values;
  return compareArray(originalValues, newValues);
};

const evalEventTimestamp = (data) => {
  const { originalEvents, newEvents } = data;
  const originalTimestamps = originalEvents.timestamps.map(
    (t) => t - originalEvents.timestamps[0]
  );
  const newTimestamps = newEvents.timestamps.map(
    (t) => t - newEvents.timestamps[0]
  );

  return compareArray(originalTimestamps, newTimestamps, compareDelayTimestamp);
};

const evalEventValueTimestamp = (data) => {
  const { originalEvents, newEvents } = data;
  const originalValues = originalEvents.values;
  const newValues = newEvents.values;
  const originalTimestamps = originalEvents.timestamps.map(
    (t) => t - originalEvents.timestamps[0]
  );
  const newTimestamps = newEvents.timestamps.map(
    (t) => t - newEvents.timestamps[0]
  );
  const valueCompare = compareArray(originalValues, newValues);
  const timestampCompare = compareArray(originalTimestamps, newTimestamps, compareDelayTimestamp);
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

  const retOK = ret.filter(r => r >=threshold);
  console.log('ret: ');
  console.log(ret);
  console.log('retOK: ');
  console.log(retOK);
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
