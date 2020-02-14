/**
 * TODO: More strategy for generating data such as: take into account the environment information (time, location, ....)
 * - Regular data: such as location path should respect the constrains about the time, velocity, ....
 * - Regular temperature: time, location, season, average temperature, the range of temperature (not too big)
 * - Regular humidility value
 */

const { getDistanceFromLine, convertDistance } = require('geolib');

const {
  randomBoolean,
  randomIntegerValue,
  randomDoubleValue,
  nextGPSPosition,
  getMin
} = require("../utils");

/**
 * Generate randomly a boolean value: 0 or 1
 *
 * @param {Object} lastValue The last generated value
 * @param {Object} dataDesc Data format description
{ "type": "boolean" }
 * @param {Function} callback The callback function
 */
const generateBooleanValue = (lastValue, dataDesc, callback) => {
  return callback(randomBoolean());
};

/**
 * Get random value in the pre-defined array
 * @param {Object} lastValue The last generated value
 * @param {Object} dataDesc Data format description which includes the array of possible value
  {
    "type": "enum",
    "values": [-5, 6, 2, 10, 12, 40]
  }
 * @param {Function} callback The callback function
 */
const getRandomEnumValue = (lastValue, dataDesc, callback) => {
  const index = randomIntegerValue(0, dataDesc.values.length - 1);
  return callback(dataDesc.values[index]);
};

/**
 * Generate randomly an integer value, based on the data description
 *
 * @param {Object} lastValue The last generated value
 * @param {Object} dataDesc The data format description
  {
    "type": "integer", // type of data
    "initValue": "18", // initial value -> can be NULL
    "min": "-273", // minimum value
    "max": "300", // maximum value
    "regular":{ // can be NULL -> the regular value
      "min": "14", // minimum of regular value
      "max": "20", // maximum of regular value
      "step": "2", // maximum different between 2 ajected values.
    }
  }

  { "type": "integer", "initValue": 18, "min": -273, "max": 300, "regular":{ "min": 14, "max": 20, "step": 2 } }
 * @param {Function} callback The callback function
 */
const generateIntegerValue = (lastValue, dataDesc, callback) => {
  if (lastValue === null && dataDesc.initValue !== null) {
    // Use initialized value
    return callback(dataDesc.initValue);
  } else {
    if (!dataDesc.regular) {
      // Generate randomly a value
      return callback(randomIntegerValue(dataDesc.min, dataDesc.max));
    } else {
      if (lastValue === null) {
        // generate the first value - it is sure that dataDesc.initValue === null
        return callback(randomIntegerValue(dataDesc.regular.min, dataDesc.regular.max));
      } else {
        // Generate a random value based on the last value
        let min = lastValue - dataDesc.regular.step/2;
        min = min < dataDesc.regular.min ? dataDesc.regular.min: min;
        let max = lastValue + dataDesc.regular.step/2;
        max = max > dataDesc.regular.max ? dataDesc.regular.max : max;
        return callback(randomIntegerValue(min, max));
      }
    }
  }
};

/**
 * Generate randomly a double value, based on the data description
 * @param {Object} lastValue The last generated value
 * @param {Object} dataDesc The data format description
  {
    "type": "double", // type of data
    "initValue":"3.5", // initial value -> can be NULL
    "min": "-10.2", // minimum value
    "max": "10.5", // maximum value
    "regular":{ // can be NULL -> the regular value
      "min": "4.0", // minimum of regular value
      "max": "5.5", // maximum of regular value
      "step": "0.5", // maximum different between 2 ajected values.
    }
  }

  '{ "type": "double", "initValue": 3.5, "min": -10.2, "max": 10.5, "regular":{ "min": 4.0, "max": 5.5, "step": 0.5 } }'
 * @param {Function} callback The callback function
 */
const generateDoubleValue = (lastValue, dataDesc, callback) => {
  if (lastValue === null && dataDesc.initValue !== null) {
    // Use initialized value
    return callback(dataDesc.initValue);
  } else {
    if (!dataDesc.regular) {
      // Generate randomly a value
      return callback(randomDoubleValue(dataDesc.min, dataDesc.max));
    } else {
      if (lastValue === null) {
        // generate the first value - it is sure that dataDesc.initValue === null
        return callback(randomDoubleValue(dataDesc.regular.min, dataDesc.regular.max));
      } else {
        // Generate a random value based on the last value
        let min = lastValue - dataDesc.regular.step/2;
        min = min < dataDesc.regular.min ? dataDesc.regular.min : min;
        let max = lastValue + dataDesc.regular.step/2;
        max = max > dataDesc.regular.max ? dataDesc.regular.max : max;
        return callback(randomDoubleValue(min, max));
      }
    }
  }
};

/**
 * Generate randomly a GPS location based on the data description
 *
 * @param {Object} lastValue The last generated value
 * @param {Object} dataDesc The data format description
  {
    "type": "location",
    "initValue": { // first position - can be NULL
      "lat": "48.828886",
      "lng": " 2.353675"
    },
    "limit": { // limitation of the location - can be NULL
      "lat" : {
        "min": "-5.0",
        "max": "10.0",
      },
      "lng": {
        "min": "-15.0",
        "max": "20.0",
      }
    },
    "bearingDirection": "180", // The bearing direction (degrees)
    "velo": "5" // The velocity of the movement (km/h) -> can be NULL
  }
  p1: 48.888973, 2.253253
  p2: 48.813183, 2.435557

  '{ "type": "location", "initValue": { "lat": 48.828886, "lng":  2.353675 }'
  '{ "type": "location", "initValue": { "lat": 48.828886, "lng":  2.353675 }, "bearingDirection": 90, "velo": 500 }'
  '{ "type": "location", "initValue": { "lat": 48.828886, "lng":  2.353675 }, "limit": { "lat" : { "min": 48.813183, "max": 48.888973 }, "lng": { "min": 2.253253, "max": 2.435557 } }, "bearingDirection": 90, "velo": 50 }'
 * @param {Function} callback the callback function
 */
const generateLocationValue = (lastValue, dataDesc, callback) => {
  let { bearingDirection } = dataDesc;
  if (!bearingDirection) {
    bearingDirection = 180;
  } else {
    bearingDirection = bearingDirection/2;
  }
  if (lastValue === null && dataDesc.initValue !== null) {
    // Use initialized value
    return callback(dataDesc.initValue);
  } else {
    if (!dataDesc.limit) {
      // Generate randomly a value without the limit
      if (!dataDesc.velo || lastValue === null) {
        // without the limit of velocity or this is the first value
        return callback({
          lat: randomDoubleValue(-90, 90),
          lng: randomDoubleValue(-180, 80)
        });
      } else {
        // with the limit of velocity and this is not the first value
        return callback(nextGPSPosition(lastValue.lat, lastValue.lng, randomDoubleValue(-bearingDirection, bearingDirection), randomDoubleValue(0,dataDesc.distanceInAMove)));
      }
    } else {
      if (!dataDesc.velo || lastValue === null) {
        // without the limit of velocity or this is the first value
        return callback({
          lat: randomDoubleValue(dataDesc.limit.lat.min, dataDesc.limit.lat.max),
          lng: randomDoubleValue(dataDesc.limit.lng.min, dataDesc.limit.lng.max)
        });
      } else {
        // with the limit of velocity and this is not the first value and the next position need to be in a limit
        const point = {latitude: lastValue.lat, longitude: lastValue.lng};
        const point1 = {latitude: dataDesc.limit.lat.min, longitude: dataDesc.limit.lng.min};
        const point2 = {latitude: dataDesc.limit.lat.min, longitude: dataDesc.limit.lng.max};
        const point3 = {latitude: dataDesc.limit.lat.max, longitude: dataDesc.limit.lng.max};
        const point4 = {latitude: dataDesc.limit.lat.max, longitude: dataDesc.limit.lng.min};
        const d1 = convertDistance(getDistanceFromLine(point,point1, point2), 'km');
        const d2 = convertDistance(getDistanceFromLine(point,point1, point4),'km');
        const d3 = convertDistance(getDistanceFromLine(point,point3, point2),'km');
        const d4 = convertDistance(getDistanceFromLine(point,point3, point4),'km');
        const min = getMin([d1,d2,d3,d4, dataDesc.distanceInAMove]);
        return callback(nextGPSPosition(lastValue.lat, lastValue.lng, randomDoubleValue(-bearingDirection, bearingDirection), randomDoubleValue(0,min)));
      }
    }
  }
};

/**
 * DataGenerator presents a Regular and Malicious Data Generator
 */
class DataGenerator {
  constructor(dataDescription, timeInterval = null) {
    this.type = dataDescription.type;
    this.dataDesc = dataDescription;
    this.lastValue = null;
    this.generateFnc = generateBooleanValue;
    switch (this.type) {
      case "Boolean":
        this.generateFnc = generateBooleanValue;
        break;
      case "integer":
        this.generateFnc = generateIntegerValue;
        break;
      case "double":
        this.generateFnc = generateDoubleValue;
        break;
      case "location":
        this.generateFnc = generateLocationValue;
        // Calculate the distance in a time period
        if (dataDescription.velo && timeInterval ) {
          this.dataDesc.distanceInAMove = dataDescription.velo / (60 * 60) * timeInterval;
        }
        break;
      case "enum":
        this.generateFnc = getRandomEnumValue;
        break;
      default:
        break;
    }
  }

  generateData(callback) {
    return this.generateFnc(this.lastValue, this.dataDesc, (data) => {
      this.lastValue = data;
      return callback(data);
    });
  }
}

module.exports = DataGenerator;
