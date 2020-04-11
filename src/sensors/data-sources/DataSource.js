const BooleanSource = require('./BooleanSource');
const EnumSource = require('./EnumSource');
const IntegerSource = require('./IntegerSource');
const FloatSource = require('./FloatSource');
const EnergySource = require('./EnergySource');
const ds = require('../../DataSourceType');

class DataSource {
  constructor(key, type, data) {
    this.key = key;
    this.type = type;
    const { id, unit, initValue } = data;
    this.value = initValue;
    this.id = id;
    this.unit = unit;
    this.dataGenerator = null;
    switch (type) {
      case ds.DS_ENERGY:
        this.dataGenerator = new EnergySource(data);
        break;
      case ds.DS_BOOLEAN:
        this.dataGenerator = new BooleanSource(data);
        break;
      case ds.DS_INTEGER:
        this.dataGenerator = new IntegerSource(data);
        break;
      case ds.DS_FLOAT:
        this.dataGenerator = new FloatSource(data);
        break;
      case ds.DS_ENUM:
        this.dataGenerator = new EnumSource(data);
        break;
      default:
        break;
    }
  }

  readData() {
    if (this.dataGenerator) {
      this.value = this.dataGenerator.readData();
    } else {
      console.error(`[${this.key}] Failed to read data`);
    }
    return this.value;
  }

  getValue() {
    return {
      value: this.value,
      unit: this.unit,
      type: this.type,
      id: this.id,
    }
  }
}

module.exports = DataSource;