const { OFFLINE, SIMULATING } = require("../DeviceStatus");

/**
 * The Actuator class presents an actuator
 * - Receive the actuated data from gateway
 * - Display the status
 */
class Actuator {
  constructor(id, actuatorData, testBroker, objectId = null) {
    this.id = id;
    this.testBroker = testBroker;
    const { name, topic } = actuatorData;
    this.name = name;
    this.objectId = objectId;
    this.actuatedData = null;
    this.timestamp = null;
    this.topic = topic;
    this.status = OFFLINE;
    // Statistics
    this.lastActivity = Date.now();
    this.numberOfReceivedData = 0;
    this.lastReceivedData = null;
  }

  getStats() {
    return {
      id: this.id,
      numberOfReceivedData: this.numberOfReceivedData,
      lastActivity: this.lastActivity,
      lastReceivedData: this.lastReceivedData,
      topic: this.topic
    }
  }

  /**
   * Update new actuated data
   * @param {Object} newData New actuated data which is sent from the gateway
   * @param {Number} timestamp The timestamp of the new data
   */
  updateActuatedData(newData, timestamp = Date.now()) {
    console.log(`[${this.id}] received a message on topic ${this.topic}`);
    this.actuatedData = newData;
    this.timestamp = timestamp;
    this.lastActivity = Date.now();
    this.lastReceivedData = newData;
    this.numberOfReceivedData++;
  }

  /**
   * Show status of the actuator
   */
  showStatus() {
    console.log(
      `[${this.id}] ${this.name} ${new Date(this.timestamp)} ${JSON.stringify(
        this.actuatedData
      )}`
    );
  }

  start() {
    if (this.status === SIMULATING) {
      console.log(`Actuator ${this.id} has been started already!`);
    } else {
      this.testBroker.subscribe(this.topic);
      this.status = SIMULATING;
    }
  }

  stop() {
    if (this.status === OFFLINE) {
      console.log(`Actuator ${this.id} is offline!`);
    } else {
      this.testBroker.unsubscribe(this.topic);
      this.status = OFFLINE;
    }
  }
}

module.exports = Actuator;
