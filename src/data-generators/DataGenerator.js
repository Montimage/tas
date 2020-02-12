const {
  randomBoolean,
  randomIntegerValue,
  randomDoubleValue
} = require("../utils");

const generateBooleanValue = (dataDesc, callback) => {
  return callback(randomBoolean());
};

const generateIntegerValue = (dataDesc, callback) => {
  return callback(randomIntegerValue(dataDesc.min, dataDesc.max));
};

const generateDoubleValue = (dataDesc, callback) => {
  return callback(randomDoubleValue(dataDesc.min, dataDesc.max));
};

const generateLocationValue = (dataDesc, callback) => {
  return callback({
    la: randomDoubleValue(-90, 90),
    lo: randomDoubleValue(-180, 80)
  });
};

const getRandomEnumValue = (dataDesc, callback) => {
  const index = randomIntegerValue(0, dataDesc.values.length - 1);
  return callback(dataDesc.values[index]);
};

/**
 * DataGenerator presents a Regular and Malicious Data Generator
 */
class DataGenerator {
  constructor(dataDescription) {
    this.type = dataDescription.type;
    this.dataDesc = dataDescription;
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
        break;
      case "enum":
        this.generateFnc = getRandomEnumValue;
        break;
      default:
        break;
    }
  }

  generateData(callback) {
    return this.generateFnc(this.dataDesc, callback);
  }
}

module.exports = DataGenerator;
