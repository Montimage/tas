const { SIMULATING, OFFLINE } = require('../constants');
/**
 * The Actuator class presents an actuator
 * - Receive the actuated data from gateway
 * - Display the status
 */
class Actuator{
  constructor(id, topic) {
    this.id = id;
    this.topic = topic;
    this.mqttClient = null;
    this.status = OFFLINE;
    this.actuatedData = null;
    this.timestamp = null;
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
    console.log(`[Actuator ${this.id}] ${this.timestamp} ${JSON.stringify(this.actuatedData)}`);
  }

  /**
   * Start simulating an actuator
   * @param {Object} mqttClient MQTT client
   */
  start(mqttClient) {
    this.mqttClient = mqttClient;
    if (this.status === OFFLINE) {
      this.mqttClient.subscribe(this.topic, (err) => {
        if (err) {
          console.error(`[Actuator ${this.id}] Cannot subscribe the topic: ${this.topic}`, err);
        } else {
          console.log(`[Actuator ${this.id}] listening on channel: ${this.topic}`);
          this.status = SIMULATING;
        }
      });
    } else {
      console.log(`[Actuator ${this.id}] status: ${this.status}`);
    }
  }

  /**
   * Stop simulating an actuator
   */
  stop() {
    if (this.status === SIMULATING) {
      this.mqttClient.unsubscribe(this.topic, (err) => {
        if (err) {
          console.error(`[Actuator ${this.id}] Cannot unsubscribe the topic: ${this.topic}`, err);
        } else {
          this.status = OFFLINE;
          console.log(`[Actuator ${this.id}] stopped!`);
        }
      })
    } else {
      console.log(`[Actuator ${this.id}] status: ${this.status}`);
    }
  }
}

module.exports = Actuator;