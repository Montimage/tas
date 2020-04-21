const FIX_STRING_VALUE = "invalid-value-string-value";
const FIX_OBJECT_VALUE = { key: "invalid-object-value" };

//////////////////////////////
// BOOLEAN DATA             //
//////////////////////////////
/**
 * Get a random boolean value
 * @returns True or False
 */
const getRandomBoolean = () => (Math.random() < 0.5 ? false : true);

/**
 * Get a random boolean value in number
 * @returns 1 - True or 0 - False
 */
const getRandomBinaryBoolean = () => (Math.random() < 0.5 ? 0 : 1);

/**
 * Get a random not boolean value
 * @returns 2 or FIX_STRING_VALUE
 */
const getNotBoolean = () => (Math.random() < 0.5 ? 2 : FIX_STRING_VALUE);

//////////////////////////////
// INTEGER DATA             //
//////////////////////////////
/**
 * Get a random integer number in a range
 * @param {Number} min The smallest possible number
 * @param {Number} max The biggest possible number
 * @returns number: min <= number <= max
 */
const getRandomInteger = (min, max) =>
  min + Math.round(Math.random() * (max - min));

/**
 * Get a random not integer number
 * @returns an object or a string value
 */
const getNotInteger = () =>
  Math.random() < 0.5 ? FIX_OBJECT_VALUE : FIX_STRING_VALUE;

/**
 * Get a random integer number with the constraint of the step of change
 * @param {Number} min The smallest number
 * @param {Number} max The biggest number
 * @param {Number} step The maximum different value can be changed compare with previous value
 * @param {Number} lastValue The last value (previous value)
 */
const getRandomIntegerWithStep = (min, max, step, lastValue) => {
  if (lastValue < min || lastValue > max) return Math.round((min + max) / 2);

  const fmin = min > lastValue - step ? min : lastValue - step;
  const fmax = max < lastValue + step ? max : lastValue + step;

  return getRandomInteger(fmin, fmax);
};

/**
 * Get a random integer number out of the selected range
 * @param {Number} min The smalles number
 * @param {Number} max The biggest number
 */
const getIntegerOutOfRange = (min, max) => {
  let fmin = max + 1;
  let fmax = min - 1;
  if (Math.random() < 0.5) {
    fmin = min - 10 * (max - min);
  } else {
    fmax = max + 10 * (max - min);
  }
  return getRandomInteger(fmin, fmax);
};

/**
 * Get a random integer number out of regular range
 * @param {Number} min The smallest number
 * @param {Number} max The biggest number
 * @param {Number} rmin The smallest regular number
 * @param {Number} rmax The biggest regular number
 */
const getIntegerOutOfRegularRange = (min, max, rmin, rmax) => {
  let fmax = rmin - 1;
  let fmin = rmax + 1;
  if (Math.random() < 0.5) {
    fmin = min;
  } else {
    fmax = max;
  }

  return getRandomInteger(fmin, fmax);
};

/**
 * Get a random integer number out of the step but still in the range
 * @param {Number} rmin The smallest regular number
 * @param {Number} rmax The biggest regular number
 * @param {Number} step The maximum different between 2 continious value
 * @param {Number} lastValue The last value
 */
const getIntegerOutOfRegularStep = (rmin, rmax, step, lastValue) => {
  let fmin = rmin;
  let fmax = rmax;
  if (lastValue + step + 1 > rmax && lastValue - step - 1 < rmin) {
    console.error(
      `[GENERATOR] Impossible to generate a value out of range ${rmin} - ${rmax} with step ${step} and last value ${lastValue} `
    );
    return Math.round((rmin + rmax) / 2);
  }

  if (lastValue + step + 1 >= rmax) {
    fmax = lastValue - step - 1;
  } else if (lastValue - step -1 <= rmin) {
    fmin = lastValue + step + 1;
  } else {
    if (Math.random() < 0.5) {
      fmax = lastValue - step - 1;
    } else {
      fmin = lastValue + step + 1;
    }
  }

  return getRandomInteger(fmin, fmax);
};

/**
 * Get the next bigger value
 * @param {Number} max The maximum number
 * @param {Number} step The maximum change in value
 * @param {Number} lastValue The last value
 */
const getNextUpInteger = (max, step, lastValue) => {
  if (lastValue >= max) return max;
  let fmin = lastValue;
  let fmax = lastValue + step;
  fmax = fmax < max ? fmax : max;
  return getRandomInteger(fmin, fmax);
};

/**
 * Get the next smaller number
 * @param {Number} min The minimum possible number
 * @param {Number} step The maximum change in value
 * @param {Number} lastValue The last value
 */
const getNextDownInteger = (min, step, lastValue) => {
  if (lastValue <= min && lastValue < step / 10) return min;
  let fmax = lastValue;
  let fmin = lastValue - step;
  fmin = fmin < min ? min : fmin;
  return getRandomInteger(fmin, fmax);
};

//////////////////////////////
// FLOAT DATA               //
//////////////////////////////

/**
 * Get a random float number in a range
 * @param {Number} min The smallest possible number
 * @param {Number} max The biggest possible number
 * @returns number: min <= number < max
 */
const getRandomFloat = (min, max) => min + Math.random() * (max - min);

/**
 * Get a random not float number
 * @returns an object or a string value
 */
const getNotFloat = () =>
  Math.random() < 0.5 ? FIX_OBJECT_VALUE : FIX_STRING_VALUE;

/**
 * Get a random float number with the constraint of the step of change
 * @param {Number} min The smallest number
 * @param {Number} max The biggest number
 * @param {Number} step The maximum different value can be changed compare with previous value
 * @param {Number} lastValue The last value (previous value)
 */
const getRandomFloatWithStep = (min, max, step, lastValue) => {
  if (lastValue < min || lastValue > max) return (min + max) / 2;

  const fmin = min > lastValue - step ? min : lastValue - step;
  const fmax = max < lastValue + step ? max : lastValue + step;

  return getRandomFloat(fmin, fmax);
};

/**
 * Get a random float number out of the selected range
 * @param {Number} min The smalles number
 * @param {Number} max The biggest number
 */
const getFloatOutOfRange = (min, max) => {
  let fmin = max + 0.0001;
  let fmax = min - 0.0001;
  if (Math.random() < 0.5) {
    fmin = min - 10 * (max - min);
  } else {
    fmax = max + 10 * (max - min);
  }
  return getRandomFloat(fmin, fmax);
};

/**
 * Get a random float number out of regular range
 * @param {Number} min The smallest number
 * @param {Number} max The biggest number
 * @param {Number} rmin The smallest regular number
 * @param {Number} rmax The biggest regular number
 */
const getFloatOutOfRegularRange = (min, max, rmin, rmax) => {
  let fmax = rmin - 0.0001;
  let fmin = rmax + 0.0001;
  if (Math.random() < 0.5) {
    fmin = min;
  } else {
    fmax = max;
  }

  return getRandomFloat(fmin, fmax);
};

/**
 * Get a random float number out of the step but still in the range
 * @param {Number} rmin The smallest regular number
 * @param {Number} rmax The biggest regular number
 * @param {Number} step The maximum different between 2 continious value
 * @param {Number} lastValue The last value
 */
const getFloatOutOfRegularStep = (rmin, rmax, step, lastValue) => {
  let fmin = rmin;
  let fmax = rmax;
  if (lastValue + step + step / 10 > rmax && lastValue - step - step / 10 < rmin) {
    console.error(
      `[GENERATOR] Impossible to generate a value out of range ${rmin} - ${rmax} with step ${step} and last value ${lastValue} `
    );
    return (rmin + rmax) / 2;
  }

  if (lastValue + step + step / 10> rmax) {
    fmax = lastValue - step - step / 10;
  } else if (lastValue - step - step / 10 < rmin) {
    fmin = lastValue + step + step / 10;
  } else {
    if (Math.random() < 0.5) {
      fmax = lastValue - step - step / 10;
    } else {
      fmin = lastValue + step + step / 10;
    }
  }
  return getRandomFloat(fmin, fmax);
};

/**
 * Get the next bigger value
 * @param {Number} max The maximum number
 * @param {Number} step The maximum change in value
 * @param {Number} lastValue The last value
 */
const getNextUpFloat = (max, step, lastValue) => {
  if (lastValue >= max) return max;
  let fmin = lastValue;
  let fmax = lastValue + step;
  fmax = fmax < max ? fmax : max;
  return getRandomFloat(fmin, fmax);
};

/**
 * Get the next smaller number
 * @param {Number} min The minimum possible number
 * @param {Number} step The maximum change in value
 * @param {Number} lastValue The last value
 */
const getNextDownFloat = (min, step, lastValue) => {
  if (lastValue <= min || lastValue < step / 10) return min;
  let fmax = lastValue;
  let fmin = lastValue - step;
  fmin = fmin < min ? min : fmin;
  return getRandomFloat(fmin, fmax);
};

//////////////////////////////
// ENUM DATA                //
//////////////////////////////

/**
 * Get a random value in an array
 * @param {Array} values The array of enum value
 * @returns v : v in values
 */
const getRandomEnum = (values) => {
  if (!values || values.length === 0) return null;
  return values[getRandomInteger(0, values.length-1)];
};

/**
 * Get a random value not in an array
 * @returns an object or a string value
 */
const getNotEnum = () =>
  Math.random() < 0.5 ? FIX_OBJECT_VALUE : FIX_STRING_VALUE;

module.exports = {
  getRandomBoolean,
  getRandomBinaryBoolean,
  getRandomEnum,
  getRandomInteger,
  getRandomIntegerWithStep,
  getNextUpInteger,
  getNextDownInteger,
  getRandomFloat,
  getRandomFloatWithStep,
  getNextUpFloat,
  getNextDownFloat,
  getNotBoolean,
  getNotEnum,
  getNotInteger,
  getIntegerOutOfRange,
  getIntegerOutOfRegularRange,
  getIntegerOutOfRegularStep,
  getNotFloat,
  getFloatOutOfRange,
  getFloatOutOfRegularRange,
  getFloatOutOfRegularStep,
};
