// Bounded scoring reads on the simulation-end evaluation path (issue #31).
//
// deviceCallbackWhenFinish scores the run by loading both event streams;
// reports.js bounds the same reads with MAX_SCORING_EVENTS, and this path
// must stay in step - an unbounded load here would let one long run pull its
// whole event stream into memory at scoring time. The queries are stubbed at
// the model boundary (the same seam as test/reports-pagination.test.js), so
// what is pinned is that the limit actually reaches both queries. No live
// MongoDB participates.
const { test } = require('node:test');
const assert = require('node:assert/strict');

const Simulation = require('../src/core/simulation/Simulation');
const { EventSchema, ReportSchema } = require('../src/core/enact-mongoose');

const fakeLogger = () => ({ log() {}, error() {}, warn() {}, info() {}, debug() {} });

const makeSimulation = () =>
  new Simulation(
    {
      name: 'model-1',
      dataStorage: null,
      datasetId: 'ds-original',
      newDataset: { id: 'ds-new' },
      evaluationParameters: {
        threshold: 0.5,
        eventType: 'ALL_EVENTS',
        metricType: 'METRIC_VALUE_TIMESTAMP',
      },
    },
    null,
    null,
    fakeLogger()
  );

test('the simulation-end scoring path bounds both of its event reads', async () => {
  const sim = makeSimulation();
  const calls = [];
  const originalBetween = EventSchema.findEventsBetweenTimes;
  const originalWithOptions = EventSchema.findEventsWithOptions;
  const originalUpdate = ReportSchema.findOneAndUpdate;

  EventSchema.findEventsBetweenTimes = (filter, startTime, endTime, limit) => {
    calls.push({ fn: 'between', filter, startTime, endTime, limit });
    return Promise.resolve([]);
  };
  EventSchema.findEventsWithOptions = (filter, limit) => {
    calls.push({ fn: 'withOptions', filter, limit });
    return Promise.resolve([]);
  };
  ReportSchema.findOneAndUpdate = () => Promise.resolve({});

  try {
    // No devices are running (allThings is empty), so the callback goes
    // straight to scoring; stop() finds the run already OFFLINE and stops.
    await sim.deviceCallbackWhenFinish();

    assert.equal(calls.length, 2);
    const between = calls.find((c) => c.fn === 'between');
    assert.equal(between.filter.datasetId, 'ds-original');
    assert.equal(between.limit, 10000, 'the original-side read must be bounded');
    const withOptions = calls.find((c) => c.fn === 'withOptions');
    assert.equal(withOptions.filter.datasetId, 'ds-new');
    assert.equal(withOptions.limit, 10000, 'the new-side read must be bounded');
  } finally {
    EventSchema.findEventsBetweenTimes = originalBetween;
    EventSchema.findEventsWithOptions = originalWithOptions;
    ReportSchema.findOneAndUpdate = originalUpdate;
  }
});
