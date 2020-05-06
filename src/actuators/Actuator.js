/**
 * The Actuator class presents an actuator
 * - Receive the actuated data from gateway
 * - Display the status
 */
class Actuator {
  constructor(id, actuatorData, objectId = null) {
    this.id = id;
    const { name, topic } = actuatorData;
    this.name = name;
    this.objectId = objectId;
    this.actuatedData = null;
    this.timestamp = null;
    this.topic = null;
    if (topic) {
      this.topic = topic;
    }
    if (!topic) {
      if (objectId) {
        this.topic = `things/${this.thingId}/actuators/${objectId}/${this.id}/#`;
      } else {
        this.topic = `things/${this.thingId}/actuators/${this.id}/#`;
      }
    }
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
}

module.exports = Actuator;
