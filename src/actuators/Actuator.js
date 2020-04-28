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
    console.log(
      `[${this.id}] ${this.name} ${new Date(this.timestamp)} ${JSON.stringify(
        this.actuatedData
      )}`
    );
  }
}

module.exports = Actuator;
