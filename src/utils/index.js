const randomBoolean = () => Math.random() < 0.5 ? 0: 1;

const randomIntegerValue = (min, max) => {
  const rand = Math.random();
  return Math.round(min + rand * (max-min));
}

const randomDoubleValue = (min, max) => {
  const rand = Math.random();
  return Math.round(100*(min + rand * (max-min)))/100;
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

const getMin = (array) => {
  if (!array || array.length === 0) return null;
  let min = array[0];
  for (let index = 0 ; index < array.length; index++) {
    min = min < array[index] ? min : array[index];
  }
  return min;
}

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
  randomIntegerValue,
  randomBoolean,
  nextGPSPosition,
  getMin,
  getMax
}