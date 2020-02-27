const { SIMULATING, OFFLINE } = require('../constants');
/**
 * The Actuator class presents an actuator
 * - Receive the actuated data from gateway
 * - Display the status
 */
class Actuator{
  constructor(id, options) {
    this.id = id;
    this.actuatedData = null;
    this.timestamp = null;
    this.options = options;
  }

  /**
   * Update new actuated data
   * @param {Object} newData New actuated data which is sent from the gateway
   * @param {Number} timestamp The timestamp of the new data
   */
  updateActuatedData(newData, timestamp = Date.now()) {
    this.actuatedData = newData;
    this.timestamp = timestamp;
  }

  /**
   * Show status of the actuator
   */
  showStatus() {
    console.log(`[${this.id}] ${new Date(this.timestamp)} ${JSON.stringify(this.actuatedData)}`);
  }
}

module.exports = Actuator;