const { AB_FIX_VALUE, NORMAL_BEHAVIOUR } = require('../../AbnormalBehaviours');
class DataSourceAbstract {
  constructor(data) {
    const { behaviours, initValue } = data;
    this.behaviours = behaviours;
    if (!this.behaviours || this.behaviours.length === 0) {
      this.behaviours = [NORMAL_BEHAVIOUR];
    }
    this.value = initValue;
  }

  readData() {
    if (this.behaviours.length === 1 && this.behaviours.indexOf(AB_FIX_VALUE) >= 0) {
      // always return fix value
      return this.value;
    }
    return null;
  }
}

module.exports = DataSourceAbstract;