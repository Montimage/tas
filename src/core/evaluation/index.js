/**
 * Evaluation module
 * - Evaluate the simulation result by comparing the original event streams with the simulated event streams
 * There should be many different way to evaluate the result. In this version, we will go one by one
 * - 1: compare events order
 */

const ALL_EVENT_ORDERING = "ALL_EVENT_ORDERING"; //all the events
const ALL_EVENT_ORDERING_WITH_TIMESTAMP = "ALL_EVENT_ORDERING_WITH_TIMESTAMP"; //all the events with respecting of timestamp
const ACTUATOR_EVENTS_ORDERING = "ACTUATOR_EVENTS_ORDERING"; //only actuator event
const ACTUATOR_EVENTS_ORDERING_WITH_TIMESTAMP =
  "ACTUATOR_EVENTS_ORDERING_WITH_TIMESTAMP"; //only actuator event with repsecting of timestamp
const METRIC_VALUE = "METRIC_VALUE";
const METRIC_VALUE_TIMESTAMP = "METRIC_VALUE_TIMESTAMP";

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

const evalEventValue = (data) => {
  const { originalEvents, newEvents } = data;
  const originalValues = originalEvents.values;
  const newValues = newEvents.values;
  return compareArray(originalValues, newValues);
};

const compareDelayTimestamp = (t1, t2) => {
  return Math.abs(t2-t1)/t1 < 0.01; // 1% threashold
}

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

const evaluateEvents = (originalEvents, newEvents, metrics = "VALUE", threashold = 0.5) => {
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
  console.log(JSON.stringify(topics));
  for (let index = 0; index < topicValues.length; index++) {
    const topic = topicValues[index];
    if (metrics === METRIC_VALUE) {
      const evalTopic = evalEventValue(topics[topic]);
      ret.push(evalTopic);
    } else {
      const evalTopic = evalEventValueTimestamp(topics[topic]);
      ret.push(evalTopic);
    }
  }
  const retOK = ret.filter(r => r >=threashold);

  console.log('ret: ', ret);
  console.log('retOK: ', retOK);
  return retOK.length / ret.length;
};

const evalAllEventByValue = (originalEvents, newEvents) => {
  return evaluateEvents(originalEvents, newEvents, METRIC_VALUE);
};

const evalAllEventByValueWithTimestamp = (originalEvents, newEvents) => {
  return evaluateEvents(originalEvents, newEvents, METRIC_VALUE_TIMESTAMP);
};

const evalActuatorEventOrdering = (originalEvents, newEvents) => {
  const originalActuatorEvents = originalEvents.filter((e) => !e.isSensorData);
  const newActuatorEvents = newEvents.filter((e) => !e.isSensorData);
  return evaluateEvents(
    originalActuatorEvents,
    newActuatorEvents,
    METRIC_VALUE
  );
};

const evalActuatorEventOrderingWithTimestamp = (originalEvents, newEvents) => {
  const originalActuatorEvents = originalEvents.filter((e) => !e.isSensorData);
  const newActuatorEvents = newEvents.filter((e) => !e.isSensorData);
  return evaluateEvents(
    originalActuatorEvents,
    newActuatorEvents,
    METRIC_VALUE_TIMESTAMP
  );
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
  method = "ACTUATOR_EVENTS_ORDERING"
) => {
  switch (method) {
    case ALL_EVENT_ORDERING:
      return evalAllEventByValue(originalEvents, newEvents);
    case ALL_EVENT_ORDERING_WITH_TIMESTAMP:
      return evalAllEventByValueWithTimestamp(originalEvents, newEvents);
    case ACTUATOR_EVENTS_ORDERING:
      return evalActuatorEventOrdering(originalEvents, newEvents);
    case ACTUATOR_EVENTS_ORDERING_WITH_TIMESTAMP:
      return evalActuatorEventOrderingWithTimestamp(originalEvents, newEvents);
    default:
      console.error(`[EVALUATION] Unsupported method: ${method}`);
      return null;
  }
};

module.exports = {
  ALL_EVENT_ORDERING,
  ALL_EVENT_ORDERING_WITH_TIMESTAMP,
  ACTUATOR_EVENTS_ORDERING,
  ACTUATOR_EVENTS_ORDERING_WITH_TIMESTAMP,
  evalulate,
};
