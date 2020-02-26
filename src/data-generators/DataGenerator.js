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
  randomPoisonIntegerValue,
  randomDoubleValue,
  randomPoisonDoubleValue,
  nextGPSPosition,
  getMin
} = require("../utils");

/**
 * DataGenerator presents a Regular and Malicious Data Generator
 */
class DataGenerator {
  constructor(dataDescription) {
    const {timeInterval} = dataDescription;
    this.type = dataDescription.type;
    this.dataDesc = dataDescription;
    this.lastValue = null;
    this.generateFnc = this.generateBooleanValue;
    switch (this.type) {
      case 'boolean':
      case "Boolean":
        this.generateFnc = this.generateBooleanValue;
        break;
      case "integer":
      case "Integer":
        this.generateFnc = this.generateIntegerValue;
        break;
      case "double":
      case "Double":
        this.generateFnc = this.generateDoubleValue;
        break;
      case "location":
      case "Location":
        this.generateFnc = this.generateLocationValue;
        // Calculate the distance in a time period
        if (dataDescription.velo && timeInterval ) {
          this.dataDesc.distanceInAMove = dataDescription.velo / (60 * 60) * timeInterval;
        }
        break;
      case "enum":
      case "Enum":
        this.generateFnc = this.getRandomEnumValue;
        break;
      default:
        break;
    }
  }

  /**
   * Generate randomly a boolean value: 0 or 1
   *
   * @param {Object} lastValue The last generated value
   * @param {Object} dataDesc Data format description
  { "type": "boolean" }
  * @param {Function} callback The callback function
  */
  generateBooleanValue = (callback) => {
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
  getRandomEnumValue = (callback) => {
    const index = randomIntegerValue(0, this.dataDesc.values.length - 1);
    return callback(this.dataDesc.values[index]);
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
      },
      "malicious": "abnormal" // abnormal | poisoning | tbd ...
    }

    -> poisoning data
      + the value is not in the regular range values
    -> abnormal behaviour
      + the next value is in the regular range value but does not respect the maximum different between 2 value

    '{ "type": "integer", "initValue": 18, "min": -273, "max": 300, "malicious": "poisoning" }'
    '{ "type": "integer", "initValue": 18, "min": -273, "max": 300, "regular":{ "min": 14, "max": 20, "step": 2 }, "malicious": "poisoning" }'
    '{ "type": "integer", "initValue": 18, "min": -273, "max": 300, "regular":{ "min": 14, "max": 20, "step": 2 }, "malicious": "poisoning" }'
    '{ "type": "integer", "initValue": 18, "min": -273, "max": 300, "regular":{ "min": 14, "max": 20, "step": 2 }, "malicious": "abnormal" }'

  * @param {Function} callback The callback function
  */
  generateIntegerValue = (callback) => {
    if (this.lastValue === null && this.dataDesc.initValue !== null) {
      // Use initialized value
      return callback(this.dataDesc.initValue);
    } else {
      if (!this.dataDesc.regular) {
        // Generate randomly a value
        if (this.dataDesc.malicious && this.dataDesc.malicious === "poisoning") {
          return callback(randomPoisonIntegerValue(this.dataDesc.min, this.dataDesc.max));
        } else {
          return callback(randomIntegerValue(this.dataDesc.min, this.dataDesc.max));
        }
      } else {
        if (this.dataDesc.malicious && this.dataDesc.malicious === "poisoning") {
          // Poisoning attack
          return callback(randomPoisonIntegerValue(this.dataDesc.regular.min,this.dataDesc.regular.max));
        } else {
          if (this.lastValue === null) {
            // generate the first value - it is sure that this.dataDesc.initValue === null
            return callback(
              randomIntegerValue(this.dataDesc.regular.min, this.dataDesc.regular.max)
            );
          } else {
            let min = this.lastValue - this.dataDesc.regular.step;
            let max = this.lastValue + this.dataDesc.regular.step;
            // Generate a random value based on the last value
            if (this.dataDesc.malicious && this.dataDesc.malicious === "abnormal") {
              if (min <= this.dataDesc.regular.min) {
                // The abnormal value must be close to the max value
                return callback(randomIntegerValue(max + 1, this.dataDesc.regular.max));
              } else if (max >= this.dataDesc.regular.max) {
                // The abnormal value must be close to the min value
                return callback(randomIntegerValue(this.dataDesc.regular.min, min - 1));
              } else {
                return callback(randomPoisonIntegerValue(min, max, {MIN: this.dataDesc.regular.min, MAX: this.dataDesc.regular.max}));
              }
            } else {
              if (min < this.dataDesc.regular.min) min = this.dataDesc.regular.min;
              if (max > this.dataDesc.regular.max) max = this.dataDesc.regular.max;
              return callback(randomIntegerValue(min, max));
            }
          }
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
      },
      "malicious": "abnormal" // abnormal | poisoning | tbd ...
    }
    -> poisoning data
      + the value is not in the regular range values
    -> abnormal behaviour
      + the next value is in the regular range value but does not respect the maximum different between 2 value

    '{ "type": "double", "initValue": 3.5, "min": -10.2, "max": 10.5}'
    '{ "type": "double", "initValue": 3.5, "min": -10.2, "max": 10.5, "malicious": "poisoning" }'
    '{ "type": "double", "initValue": 3.5, "min": -10.2, "max": 10.5, "regular":{ "min": 4.0, "max": 5.5, "step": 0.5 } }'
    '{ "type": "double", "initValue": 3.5, "min": -10.2, "max": 10.5, "regular":{ "min": 4.0, "max": 5.5, "step": 0.5 }, "malicious": "poisoning"}'
    '{ "type": "double", "initValue": 3.5, "min": -10.2, "max": 10.5, "regular":{ "min": 4.0, "max": 5.5, "step": 0.5 }, "malicious": "abnormal"}'

  * @param {Function} callback The callback function
  */
  generateDoubleValue = (callback) => {
    if (this.lastValue === null && this.dataDesc.initValue !== null) {
      // Use initialized value
      return callback(this.dataDesc.initValue);
    } else {
      if (!this.dataDesc.regular) {
        // Generate randomly a value
        if (this.dataDesc.malicious && this.dataDesc.malicious === "poisoning") {
          return callback(randomPoisonDoubleValue(this.dataDesc.min, this.dataDesc.max));
        } else {
          return callback(randomDoubleValue(this.dataDesc.min, this.dataDesc.max));
        }
      } else {
        if (this.dataDesc.malicious && this.dataDesc.malicious === "poisoning") {
          // Poisoning attack
          return callback(randomPoisonDoubleValue(this.dataDesc.regular.min,this.dataDesc.regular.max));
        } else {
          if (this.lastValue === null) {
            // generate the first value - it is sure that this.dataDesc.initValue === null
            return callback(
              randomDoubleValue(this.dataDesc.regular.min, this.dataDesc.regular.max)
            );
          } else {
            let min = this.lastValue - this.dataDesc.regular.step;
            let max = this.lastValue + this.dataDesc.regular.step;
            // Generate a random value based on the last value
            if (this.dataDesc.malicious && this.dataDesc.malicious === "abnormal") {
              if (min <= this.dataDesc.regular.min) {
                // The abnormal value must be close to the max value
                return callback(randomDoubleValue(max + 0.01, this.dataDesc.regular.max));
              } else if (max >= this.dataDesc.regular.max) {
                // The abnormal value must be close to the min value
                return callback(randomDoubleValue(this.dataDesc.regular.min, min - 0.01));
              } else {
                return callback(randomPoisonDoubleValue(min, max, {MIN: this.dataDesc.regular.min, MAX: this.dataDesc.regular.max}));
              }
            } else {
              if (min < this.dataDesc.regular.min) min = this.dataDesc.regular.min;
              if (max > this.dataDesc.regular.max) max = this.dataDesc.regular.max;
              return callback(randomDoubleValue(min, max));
            }
          }
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
      "velo": "5",  // The velocity of the movement (km/h) -> can be NULL
      "malicious": "abnormal" // abnormal | poisoning | tbd ...
    }
    -> poisoning data
      + the value is not in the limited zone
    -> abnormal behaviour
      + the next value is in the regular range value but does not respect the velocity of the movement
      FACT: this simulation is only valid for a flying object without any limit on the route, so the limited zone is not very convient to define a regular movement.
      -> So in this case the poisoning and the abnormal behaviour should be the same.
    p1: 48.888973, 2.253253
    p2: 48.813183, 2.435557

    '{ "type": "location", "initValue": { "lat": 48.828886, "lng":  2.353675 }}'
    '{ "type": "location", "initValue": { "lat": 48.828886, "lng":  2.353675 }, "malicious":"poisoning"}'
    '{ "type": "location", "initValue": { "lat": 48.828886, "lng":  2.353675 }, "bearingDirection": 90, "velo": 500 }'
    '{ "type": "location", "initValue": { "lat": 48.828886, "lng":  2.353675 }, "bearingDirection": 90, "velo": 500, "malicious":"poisoning" }'
    '{ "type": "location", "initValue": { "lat": 48.828886, "lng":  2.353675 }, "bearingDirection": 90, "velo": 500, "malicious":"abnormal" }'
    '{ "type": "location", "initValue": { "lat": 48.828886, "lng":  2.353675 }, "limit": { "lat" : { "min": 48.813183, "max": 48.888973 }, "lng": { "min": 2.253253, "max": 2.435557 } }, "bearingDirection": 90, "velo": 50 }'
    '{ "type": "location", "initValue": { "lat": 48.828886, "lng":  2.353675 }, "limit": { "lat" : { "min": 48.813183, "max": 48.888973 }, "lng": { "min": 2.253253, "max": 2.435557 } }, "bearingDirection": 90, "velo": 50 , "malicious":"poisoning" }'
    '{ "type": "location", "initValue": { "lat": 48.828886, "lng":  2.353675 }, "limit": { "lat" : { "min": 48.813183, "max": 48.888973 }, "lng": { "min": 2.253253, "max": 2.435557 } }, "bearingDirection": 90, "velo": 50 , "malicious":"abnormal" }'

  * @param {Function} callback the callback function
  */
  generateLocationValue = (callback) => {
    let { bearingDirection } = this.dataDesc;
    if (!bearingDirection) {
      bearingDirection = 180;
    } else {
      bearingDirection = bearingDirection/2;
    }
    if (this.lastValue === null && this.dataDesc.initValue !== null) {
      // Use initialized value
      return callback(this.dataDesc.initValue);
    } else {
      if (!this.dataDesc.limit) {
        // Generate randomly a value without the limit
        if (!this.dataDesc.velo || this.lastValue === null) {
          // without the limit of velocity or this is the first value
          if (this.dataDesc.malicious && this.dataDesc.malicious === 'poisoning') {
            // Poisoning attack
            return callback({
              lat: randomPoisonDoubleValue(-90, 90, 1),
              lng: randomPoisonDoubleValue(-180, 80, 1)
            });
          } else {
            return callback({
              lat: randomDoubleValue(-90, 90),
              lng: randomDoubleValue(-180, 80)
            });
          }
        } else {
          if (this.dataDesc.malicious && this.dataDesc.malicious === 'poisoning') {
            // Poisoning attack
            return callback({
              lat: randomPoisonDoubleValue(-90, 90, 1),
              lng: randomPoisonDoubleValue(-180, 80, 1)
            });
          } else if (this.dataDesc.malicious && this.dataDesc.malicious === 'abnormal') {
            return callback(nextGPSPosition(this.lastValue.lat, this.lastValue.lng, randomDoubleValue(-bearingDirection, bearingDirection), randomDoubleValue(0, this.dataDesc.distanceInAMove)));
          } else {
            // with the limit of velocity and this is not the first value
            return callback(nextGPSPosition(this.lastValue.lat, this.lastValue.lng, randomDoubleValue(-bearingDirection, bearingDirection), randomDoubleValue(this.dataDesc.distanceInAMove + 0.01, 10 * this.dataDesc.distanceInAMove)));
          }
        }
      } else {
        if (!this.dataDesc.velo || this.lastValue === null) {
          // without the limit of velocity or this is the first value
          if (this.dataDesc.malicious && this.dataDesc.malicious === 'poisoning') {
            // Poisoning attack
            return callback({
              lat: randomPoisonDoubleValue(this.dataDesc.limit.lat.min, this.dataDesc.limit.lat.max),
              lng: randomPoisonDoubleValue(this.dataDesc.limit.lng.min, this.dataDesc.limit.lng.max)
            });
          } else {
            return callback({
              lat: randomDoubleValue(this.dataDesc.limit.lat.min, this.dataDesc.limit.lat.max),
              lng: randomDoubleValue(this.dataDesc.limit.lng.min, this.dataDesc.limit.lng.max)
            });
          }
        } else {
          const point = {latitude: this.lastValue.lat, longitude: this.lastValue.lng};
          const point1 = {latitude: this.dataDesc.limit.lat.min, longitude: this.dataDesc.limit.lng.min};
          const point2 = {latitude: this.dataDesc.limit.lat.min, longitude: this.dataDesc.limit.lng.max};
          const point3 = {latitude: this.dataDesc.limit.lat.max, longitude: this.dataDesc.limit.lng.max};
          const point4 = {latitude: this.dataDesc.limit.lat.max, longitude: this.dataDesc.limit.lng.min};
          if (this.dataDesc.malicious && this.dataDesc.malicious === 'abnormal') {
            return callback(nextGPSPosition(this.lastValue.lat, this.lastValue.lng, randomDoubleValue(-bearingDirection, bearingDirection), randomDoubleValue(this.dataDesc.distanceInAMove + 0.01, 10 * this.dataDesc.distanceInAMove)));
          } else {
            // with the limit of velocity and this is not the first value and the next position need to be in a limit
            const d1 = convertDistance(getDistanceFromLine(point,point1, point2), 'km');
            const d2 = convertDistance(getDistanceFromLine(point,point1, point4),'km');
            const d3 = convertDistance(getDistanceFromLine(point,point3, point2),'km');
            const d4 = convertDistance(getDistanceFromLine(point,point3, point4),'km');
            const min = getMin([d1,d2,d3,d4, this.dataDesc.distanceInAMove]);
            return callback(nextGPSPosition(this.lastValue.lat, this.lastValue.lng, randomDoubleValue(-bearingDirection, bearingDirection), randomDoubleValue(0,min)));
          }
        }
      }
    }
  };

  generateData(callback) {
    return this.generateFnc((data) => {
      this.lastValue = data;
      return callback(data);
    });
  }
}

module.exports = DataGenerator;
