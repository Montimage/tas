const DataGeneratorAbstract = require('./DataSourceAbstract');
const {AB_FIX_VALUE, AB_INVALID_VALUE, NORMAL_BEHAVIOUR} = require('../../AbnormalBehaviours');
const { getRandomInteger, getNextDownFloat, getNotFloat } = require('./generator');
/**
 * Boolean Data Generator
 * Possible behaviour:
 * - AB_FIX_VALUE
 * - AB_INVALID_VALUE
 * - NORMAL_BEHAVIOUR
 */
class EnergySource extends DataGeneratorAbstract {
  constructor(data) {
    super(data);
    this.low = data.low;
    this.consumInOnePeriod = data.consumInOnePeriod;
    this.slowDownWeight = data.slowDownWeight;
  }

  readData() {
    if (this.value <= 0) return 0; // out of energy
    let value = super.readData();
    if (value) return value;
    const beha = this.behaviours[getRandomInteger(0, this.behaviours.length -1)];
    switch (beha) {
      case AB_FIX_VALUE:
        value = this.value;
        break;
      case AB_INVALID_VALUE:
        value = getNotFloat();
        break;
      case NORMAL_BEHAVIOUR:
        value = getNextDownFloat(0, this.consumInOnePeriod, this.value);
        break;
      default:
        console.error(`[EnergySource] Unsupported behaviour: ${beha}`);
        value = this.value;
        break;
    }
    this.value = value;
    return value;
  }
}

module.exports = EnergySource;