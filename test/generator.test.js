// Generator property tests (issue #80).
//
// Replaces src/core/sensors/data-sources/generator.test.js — an ad-hoc
// statistical loop that printed failure counts and was never run by
// `npm test`. It sampled every "out-of-*" abnormal-behaviour generator over
// thousands of draws and flagged any draw that landed inside the range or
// regular band it must avoid. The same contracts are pinned here as real
// assertions over a fixed sample size, plus the deterministic mid-point
// fallbacks used when an out-of-step value is mathematically impossible.
// No database, no broker, no randomness seeding required: every assertion
// holds for every possible draw.
const test = require('node:test');
const assert = require('node:assert/strict');

const gen = require('../src/core/sensors/data-sources/generator');

const SAMPLES = 500;
const MIN = -273;
const MAX = 100;
const REGULAR_MIN = 0;
const REGULAR_MAX = 35;

test('getRandomInteger stays inside its closed bounds', () => {
  for (let i = 0; i < SAMPLES; i++) {
    const v = gen.getRandomInteger(MIN, MAX);
    assert.ok(Number.isInteger(v), `expected an integer, got ${v}`);
    assert.ok(v >= MIN && v <= MAX, `value ${v} outside [${MIN},${MAX}]`);
  }
});

test('getRandomFloat stays inside its half-open bounds', () => {
  for (let i = 0; i < SAMPLES; i++) {
    const v = gen.getRandomFloat(MIN, MAX);
    assert.ok(typeof v === 'number' && Number.isFinite(v));
    assert.ok(v >= MIN && v < MAX, `value ${v} outside [${MIN},${MAX})`);
  }
});

test('getIntegerOutOfRange never lands inside [min,max]', () => {
  for (let i = 0; i < SAMPLES; i++) {
    const v = gen.getIntegerOutOfRange(MIN, MAX);
    assert.ok(v <= MIN || v >= MAX, `value ${v} fell inside the forbidden range (${MIN},${MAX})`);
  }
});

test('getFloatOutOfRange never lands inside [min,max]', () => {
  for (let i = 0; i < SAMPLES; i++) {
    const v = gen.getFloatOutOfRange(MIN, MAX);
    assert.ok(v <= MIN || v >= MAX, `value ${v} fell inside the forbidden range (${MIN},${MAX})`);
  }
});

test('getIntegerOutOfRegularRange stays in range but skips the regular band', () => {
  for (let i = 0; i < SAMPLES; i++) {
    const v = gen.getIntegerOutOfRegularRange(MIN, MAX, REGULAR_MIN, REGULAR_MAX);
    assert.ok(Number.isInteger(v), `expected an integer, got ${v}`);
    assert.ok(v >= MIN && v <= MAX, `value ${v} outside [${MIN},${MAX}]`);
    assert.ok(
      v < REGULAR_MIN || v > REGULAR_MAX,
      `value ${v} fell inside the regular band (${REGULAR_MIN},${REGULAR_MAX})`
    );
  }
});

test('getFloatOutOfRegularRange stays in range but skips the regular band', () => {
  for (let i = 0; i < SAMPLES; i++) {
    const v = gen.getFloatOutOfRegularRange(MIN, MAX, REGULAR_MIN, REGULAR_MAX);
    assert.ok(typeof v === 'number' && Number.isFinite(v));
    assert.ok(v >= MIN && v <= MAX, `value ${v} outside [${MIN},${MAX}]`);
    assert.ok(
      v < REGULAR_MIN || v > REGULAR_MAX,
      `value ${v} fell inside the regular band (${REGULAR_MIN},${REGULAR_MAX})`
    );
  }
});

test('getIntegerOutOfRegularStep stays in the range and jumps at least one step', () => {
  let last = 20;
  for (let i = 0; i < SAMPLES; i++) {
    const step = 2;
    const v = gen.getIntegerOutOfRegularStep(REGULAR_MIN, REGULAR_MAX, step, last);
    assert.ok(Number.isInteger(v), `expected an integer, got ${v}`);
    assert.ok(v >= REGULAR_MIN && v <= REGULAR_MAX, `value ${v} outside the regular range`);
    assert.ok(Math.abs(v - last) >= step, `value ${v} moved less than ${step} away from ${last}`);
    last = v;
  }
});

test('getFloatOutOfRegularStep stays in the range and jumps at least one step', () => {
  let last = 20;
  for (let i = 0; i < SAMPLES; i++) {
    const step = 2;
    const v = gen.getFloatOutOfRegularStep(REGULAR_MIN, REGULAR_MAX, step, last);
    assert.ok(typeof v === 'number' && Number.isFinite(v));
    assert.ok(v >= REGULAR_MIN && v <= REGULAR_MAX, `value ${v} outside the regular range`);
    assert.ok(Math.abs(v - last) >= step, `value ${v} moved less than ${step} away from ${last}`);
    last = v;
  }
});

test('an impossible out-of-integer-step request falls back to the range midpoint', () => {
  // With step 5 nothing in [2,3] can sit a full step from lastValue=2, so the
  // generator warns and returns round((rmin+rmax)/2).
  const originalError = console.error;
  let warned = false;
  console.error = () => {
    warned = true;
  };
  try {
    const v = gen.getIntegerOutOfRegularStep(2, 3, 5, 2);
    assert.equal(v, 3); // Math.round((2 + 3) / 2)
  } finally {
    console.error = originalError;
  }
  assert.ok(warned, 'the impossible request must be reported');
});

test('an impossible out-of-float-step request falls back to the exact midpoint', () => {
  const originalError = console.error;
  console.error = () => {};
  try {
    const v = gen.getFloatOutOfRegularStep(2, 3, 5, 2);
    assert.equal(v, 2.5); // (rmin + rmax) / 2, no rounding for floats
  } finally {
    console.error = originalError;
  }
});
