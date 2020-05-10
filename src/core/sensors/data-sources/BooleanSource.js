const DataGeneratorAbstract = require('./DataSourceAbstract');
const {AB_FIX_VALUE, AB_INVALID_VALUE, NORMAL_BEHAVIOUR} = require('../../AbnormalBehaviours');
const { getRandomInteger, getNotBoolean, getRandomBoolean } = require('./generator');
/**
 * Boolean Data Generator
 * Possible behaviour:
 * - AB_FIX_VALUE
 * - AB_INVALID_VALUE
 * - NORMAL_BEHAVIOUR
 */
class BooleanSource extends DataGeneratorAbstract {
  constructor(data) {
    super(data);
  }

  readData() {
    let value = super.readData();
    if (value) return value;
    const beha = this.behaviours[getRandomInteger(0, this.behaviours.length -1)];
    switch (beha) {
      case AB_FIX_VALUE:
        value = this.value;
        break;
      case AB_INVALID_VALUE:
        value = getNotBoolean();
        break;
      case NORMAL_BEHAVIOUR:
        value = getRandomBoolean();
        break;
      default:
        console.error(`[BooleanSource] Unsupported behaviour: ${beha}`);
        value = this.value;
        break;
    }
    this.value = value;
    return value;
  }
}

module.exports = BooleanSource;