const BooleanSource = require("./BooleanSource");
const EnumSource = require("./EnumSource");
const IntegerSource = require("./IntegerSource");
const FloatSource = require("./FloatSource");
const EnergySource = require("./EnergySource");
const ds = require("../../DataSourceType");

class DataSource {
  constructor(key, type, data) {
    this.key = key;
    const { resourceId , unit, initValue } = data;
    this.value = initValue ? initValue : null;
    this.resourceId = resourceId ? resourceId : null;
    this.unit = unit ? unit : null;
    this.dataGenerator = null;
    switch (type) {
      case ds.DS_ENERGY:
        this.dataGenerator = new EnergySource(data);
        this.type = "Float";
        break;
      case ds.DS_BOOLEAN:
        this.dataGenerator = new BooleanSource(data);
        this.type = "Boolean";
        break;
      case ds.DS_INTEGER:
        this.dataGenerator = new IntegerSource(data);
        this.type = "Integer";
        break;
      case ds.DS_FLOAT:
        this.dataGenerator = new FloatSource(data);
        this.type = "Float";
        break;
      case ds.DS_ENUM:
        this.dataGenerator = new EnumSource(data);
        this.type = "String";
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
      this.readData();
      return {
        resourceId: this.resourceId,
        datatype: this.type,
        value: this.value,
        unit: this.unit,
      };
  }
}

module.exports = DataSource;
