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
    const {min, max, regularMin, regularMax, step} = data.valueConstraints;
    this.min = min;
    this.max = max;
    this.regularMin = regularMin;
    this.regularMax = regularMax;
    this.step = step;
  }

  readData() {
    let value = super.readData();
    if (value) return value;
    const beha = this.behaviours[
      getRandomFloat(0, this.behaviours.length - 1)
    ];
    const rmin = this.regularMin !== null ? this.regularMin : this.min;
    const rmax = this.regularMax !== null ? this.regularMax : this.max;
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
        if (rmin===null || rmax===null || this.step===null) {
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
          if (this.step !== null) {
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
