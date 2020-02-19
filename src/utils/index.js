/**
 * Generate a random boolean value
 */
const randomBoolean = () => Math.random() < 0.5 ? 0: 1;

/**
 * Generate randomly an integer value in a range
 * @param {Number} min The minimum integer value
 * @param {Number} max The maximum integer value
 */
const randomIntegerValue = (min, max) => {
  const rand = Math.random();
  return Math.round(min + rand * (max-min));
}

/**
 * Generate randomly a double value in a range
 * @param {Number} min The minimum double value
 * @param {Number} max The maximum double value
 */
const randomDoubleValue = (min, max) => {
  const rand = Math.random();
  return Math.round(100*(min + rand * (max-min)))/100;
}

/**
 * Generate randomly a double value which is not in the range min-max, but in the range of min * scale -> max * scale
 * @param {Number} min The minimum double value
 * @param {Number} max The maximum double value
 * @param {Number} option The scale of poisoning value
 */
const randomPoisonDoubleValue = (min, max, option = 10) => {
  let min0 = min;
  const max0 = min - 0.01;
  const min1 = max + 0.01;
  let max1 = max;

  let long = max - min;
  if (typeof option === 'number') {
    long = long * option;
    min0 = min - long;
    max1 = max + long;
  } else {
    const {MIN, MAX} = option;
    if (MIN > min || MAX < max) {
      console.warn(`Invalid argument! ${MIN} > ${min} || ${MAX} < ${max}. Ignore option value!`);
      long = long * 10;
      min0 = min - long;
      max1 = max + long;
    } else {
      min0 = MIN;
      max1 = MAX;
    }
  }
  const side = Math.random();
  const rand = Math.random();
  if (side < 0.5) return Math.round(100*(min0 + rand * (max0-min0)))/100;
  return Math.round(100*(min1 + rand * (max1-min1)))/100;
}

/**
 * Generate randomly a integer value which is not in the range min-max, but in the range of min * scale -> max * scale
 * @param {Number} min The minimum integer value
 * @param {Number} max The maximum integer value
 * @param {Number} option The scale of poisoning value
 */
const randomPoisonIntegerValue = (min, max, option = 10) => {
  let min0 = min;
  const max0 = min - 1;
  const min1 = max + 1;
  let max1 = max;

  let long = max - min;
  if (typeof option === 'number') {
    long = long * option;
    min0 = min - long;
    max1 = max + long;
  } else {
    const {MIN, MAX} = option;
    if (MIN > min || MAX < max) {
      console.warn(`Invalid argument! ${MIN} > ${min} || ${MAX} < ${max}. Ignore option value!`);
      long = long * 10;
      min0 = min - long;
      max1 = max + long;
    } else {
      min0 = MIN;
      max1 = MAX;
    }
  }
  const side = Math.random();
  const rand = Math.random();
  if (side < 0.5) {
    return Math.round(min0 + rand * (max0-min0));
  }
  return Math.round(min1 + rand * (max1-min1));
}

/**
 * Calculate the next GPS position based on the current position, distance and the direction
 * @param {Number} lat The latitude value
 * @param {Number} lng the current longtitude value
 * @param {Number} bearing The bearing direction (degrees)
 * @param {Number} distance The distance in km
 */
const nextGPSPosition = (lat, lng, bearing, distance) => {
  var R = 6371; // Earth Radius in Km

  var lat2 = Math.asin(
    Math.sin((Math.PI / 180) * lat) * Math.cos(distance / R) +
      Math.cos((Math.PI / 180) * lat) *
        Math.sin(distance / R) *
        Math.cos((Math.PI / 180) * bearing)
  );
  var lon2 =
    (Math.PI / 180) * lng +
    Math.atan2(
      Math.sin((Math.PI / 180) * bearing) *
        Math.sin(distance / R) *
        Math.cos((Math.PI / 180) * lat),
      Math.cos(distance / R) - Math.sin((Math.PI / 180) * lat) * Math.sin(lat2)
    );

  return { lat: (180 / Math.PI) * lat2, lng: (180 / Math.PI) * lon2 };
};

/**
 * Get the smallest number in an array
 * @param {Array} array list of number
 */
const getMin = (array) => {
  if (!array || array.length === 0) return null;
  let min = array[0];
  for (let index = 0 ; index < array.length; index++) {
    min = min < array[index] ? min : array[index];
  }
  return min;
}

/**
 * Get the biggest number in an array
 * @param {Array} array list of number
 */
const getMax = (array) => {
  if (!array || array.length === 0) return null;
  let max = array[0];
  for (let index = 0 ; index < array.length; index++) {
    max = max > array[index] ? max : array[index];
  }
  return max;
}

module.exports = {
  randomDoubleValue,
  randomPoisonDoubleValue,
  randomIntegerValue,
  randomPoisonIntegerValue,
  randomBoolean,
  nextGPSPosition,
  getMin,
  getMax
}