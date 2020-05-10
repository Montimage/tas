const DataSourceAbstract = require("./DataSourceAbstract");
const {
  AB_FIX_VALUE,
  AB_INVALID_VALUE,
  NORMAL_BEHAVIOUR,
  AB_VALUE_CHANGE_OUT_OF_REGULAR_STEP,
  AB_VALUE_OUT_OF_RANGE,
  AB_VALUE_OUT_OF_REGULAR_RANGE
} = require("../../AbnormalBehaviours");
const {
  getRandomFloat,
  getRandomInteger,
  getNotFloat,
  getRandomFloatWithStep,
  getFloatOutOfRange,
  getFloatOutOfRegularRange,
  getFloatOutOfRegularStep,
} = require("./generator");
/**
 * Boolean Data Generator
 * Possible behaviour:
  AB_FIX_VALUE,
  AB_INVALID_VALUE,
  NORMAL_BEHAVIOUR,
  AB_VALUE_CHANGE_OUT_OF_REGULAR_STEP,
  AB_VALUE_OUT_OF_RANGE,
  AB_VALUE_OUT_OF_REGULAR_RANGE
 */
class FloatSource extends DataSourceAbstract {
  constructor(data) {
    super(data);
    if (data.valueConstraints) {
      const {min, max, regularMin, regularMax, step} = data.valueConstraints;
      this.min = min  !== null ? min : -65535;
      this.max = max  !== null ? max : 65535;
      this.regularMin = regularMin ? regularMin : min;
      this.regularMax = regularMax ? regularMax : max;
      this.step = step ? step : 0;
    }
  }

  readData() {
    let value = super.readData();
    if (value) return value;
    const beha = this.behaviours[
      getRandomInteger(0, this.behaviours.length - 1)
    ];
    let rmin = -65535;
    let rmax = 65535;
    if (this.min !== undefined && this.max !== undefined) {
      rmin = this.regularMin;
      rmax = this.regularMax;
    }
    switch (beha) {
      case AB_FIX_VALUE:
        value = this.value;
        break;
      case AB_INVALID_VALUE:
        value = getNotFloat();
        break;
      case AB_VALUE_OUT_OF_RANGE:
        if (this.min===null || this.max===null) {
          console.error(`[FloatSource] Invalid value range: ${this.min} - ${this.max}`);
          value = this.value;
        } else {
          value = getFloatOutOfRange(this.min, this.max);
        }
        break;
      case AB_VALUE_OUT_OF_REGULAR_RANGE:
          if (this.regularMin===null || this.regularMax===null || this.min===null || this.max===null) {
            console.error(`[FloatSource] Invalid value range/regular range: ${this.min} - ${this.max} | ${this.regularMin} - ${this.regularMax}`);
            value = this.value;
          } else {
            value = getFloatOutOfRegularRange(this.min, this.max, this.regularMin, this.regularMax);
            // console.log('out of regular range:', value, this.min, this.max, this.regularMin, this.regularMax);
          }
          break;
      case AB_VALUE_CHANGE_OUT_OF_REGULAR_STEP:
        if (rmin===null || rmax===null || this.step===null || this.step === 0) {
          console.error(`[FloatSource] Invalid value range or step: ${rmin} - ${rmax}, ${this.step}`);
          value = this.value;
        } else {
          value = getFloatOutOfRegularStep(rmin, rmax, this.step, this.value);
        }
        break;
      case NORMAL_BEHAVIOUR:
        if (rmin === null || rmax === null) {
          console.error(`[FloatSource] Invalid value range: ${rmin} - ${rmax}`);
          value = this.value;
        } else {
          if (this.step !== null && this.step > 0) {
            value = getRandomFloatWithStep(rmin, rmax, this.step, this.value);
          } else {
            value = getRandomFloat(rmin, rmax);
          }
        }
        break;
      default:
        console.error(`[FloatSource] Unsupported behaviour: ${beha}`);
        value = this.value;
        break;
    }
    this.value = value;
    return value;
  }
}

module.exports = FloatSource;
