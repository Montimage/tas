// Sensor data-source tests (issue #23, acceptance criterion 4: each data-source
// type). Every source subclasses DataSourceAbstract and exposes readData(),
// which honours the configured abnormal behaviours. These tests run with no
// database or broker.
const test = require('node:test');
const assert = require('node:assert/strict');

const { AB_FIX_VALUE, AB_INVALID_VALUE, NORMAL_BEHAVIOUR } = require('../../AbnormalBehaviours');
const FloatSource = require('./FloatSource');
const IntegerSource = require('./IntegerSource');
const BooleanSource = require('./BooleanSource');
const EnumSource = require('./EnumSource');
const EnergySource = require('./EnergySource');

// A value read many times under a single behaviour is stable for FIX_VALUE and
// the choice is deterministic for the others within one constructed instance.
test('FloatSource: AB_FIX_VALUE always returns the configured initValue', () => {
  const src = new FloatSource({ behaviours: [AB_FIX_VALUE], initValue: 3.14 });
  for (let i = 0; i < 20; i++) assert.strictEqual(src.readData(), 3.14);
});

test('FloatSource: NORMAL_BEHAVIOUR returns a finite number in range', () => {
  const src = new FloatSource({
    behaviours: [NORMAL_BEHAVIOUR],
    initValue: 0,
    valueConstraints: { min: 0, max: 10, regularMin: 0, regularMax: 10, step: 0.5 },
  });
  for (let i = 0; i < 20; i++) {
    const v = src.readData();
    assert.ok(typeof v === 'number' && Number.isFinite(v));
    assert.ok(v >= 0 && v <= 10, `value ${v} out of [0,10]`);
  }
});

test('FloatSource: AB_INVALID_VALUE returns a non-finite / non-number value', () => {
  const src = new FloatSource({ behaviours: [AB_INVALID_VALUE], initValue: 1 });
  const v = src.readData();
  // getNotFloat returns something that is not a finite float (string/NaN/etc).
  assert.ok(!(typeof v === 'number' && Number.isFinite(v)));
});

test('FloatSource: defaults to NORMAL_BEHAVIOUR when no behaviours given', () => {
  const src = new FloatSource({ initValue: 0, valueConstraints: { min: 0, max: 1 } });
  const v = src.readData();
  assert.ok(typeof v === 'number' && Number.isFinite(v));
});

test('IntegerSource: AB_FIX_VALUE always returns the configured initValue', () => {
  const src = new IntegerSource({ behaviours: [AB_FIX_VALUE], initValue: 42 });
  for (let i = 0; i < 20; i++) assert.strictEqual(src.readData(), 42);
});

test('IntegerSource: NORMAL_BEHAVIOUR returns an integer in range', () => {
  const src = new IntegerSource({
    behaviours: [NORMAL_BEHAVIOUR],
    initValue: 0,
    valueConstraints: { min: 1, max: 100 },
  });
  for (let i = 0; i < 20; i++) {
    const v = src.readData();
    assert.ok(Number.isInteger(v) && v >= 1 && v <= 100, `value ${v}`);
  }
});

test('BooleanSource: AB_FIX_VALUE always returns the configured initValue', () => {
  const src = new BooleanSource({ behaviours: [AB_FIX_VALUE], initValue: true });
  for (let i = 0; i < 20; i++) assert.strictEqual(src.readData(), true);
});

test('BooleanSource: NORMAL_BEHAVIOUR returns a boolean', () => {
  const src = new BooleanSource({ behaviours: [NORMAL_BEHAVIOUR], initValue: false });
  for (let i = 0; i < 20; i++) assert.strictEqual(typeof src.readData(), 'boolean');
});

test('BooleanSource: AB_INVALID_VALUE returns a non-boolean', () => {
  const src = new BooleanSource({ behaviours: [AB_INVALID_VALUE], initValue: false });
  assert.notStrictEqual(typeof src.readData(), 'boolean');
});

test('EnumSource: AB_FIX_VALUE always returns the configured initValue', () => {
  const src = new EnumSource({
    behaviours: [AB_FIX_VALUE],
    initValue: 'red',
    values: ['red', 'green', 'blue'],
  });
  for (let i = 0; i < 20; i++) assert.strictEqual(src.readData(), 'red');
});

test('EnumSource: NORMAL_BEHAVIOUR returns one of the declared values', () => {
  const values = ['red', 'green', 'blue'];
  const src = new EnumSource({ behaviours: [NORMAL_BEHAVIOUR], initValue: 'red', values });
  for (let i = 0; i < 20; i++) assert.ok(values.includes(src.readData()));
});

test('EnumSource: requires a values set and honours it', () => {
  const values = ['a', 'b'];
  const src = new EnumSource({ behaviours: [NORMAL_BEHAVIOUR], initValue: 'a', values });
  assert.deepStrictEqual(src.values, values);
});

test('EnergySource: AB_FIX_VALUE always returns the configured initValue', () => {
  const src = new EnergySource({ behaviours: [AB_FIX_VALUE], initValue: 1234 });
  for (let i = 0; i < 20; i++) assert.strictEqual(src.readData(), 1234);
});

test('EnergySource: NORMAL_BEHAVIOUR returns a finite number', () => {
  const src = new EnergySource({ behaviours: [NORMAL_BEHAVIOUR], initValue: 0 });
  for (let i = 0; i < 20; i++) {
    const v = src.readData();
    assert.ok(typeof v === 'number' && Number.isFinite(v));
  }
});
