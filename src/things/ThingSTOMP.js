const stompit = require("stompit");
const Thing = require('./Thing');
const {
  ONLINE,
  SIMULATING,
} = require('../DeviceStatus');
/**
 * The Thing class presents a THING component:
 * - List of sensors
 * - List of actuators
 * - Possibility to communicate with a gateway
 *  + send data - to multiple channels: `things/thing-id/sensors/sensor-id`
 *  + receive data - listen to multiple channels: `things/thing-id/actuators/#`
 */
class ThingSTOMP extends Thing {
  constructor(id) {
    super(id);
    this.stompClient = null;
    this.stompTopics = {};
    this.actuatedTopic = `things/${id}/actuators/`;
    this.stompConfig = null;
  }

  /**
   * handle actuated data
   * @param {String} topic topic of the received packet
   * @param {String} message payload of the received packet
   * @param {Object} packet received packet, as defined in mqtt-packet
   */
  handleSTOMPMessage(message) {
    // this.stompClient.ack(message); // ack message
    this.lastActivity = Date.now();
    this.numberOfReceivedData++;
    const topic = message.headers.destination;
    message.readString("UTF-8", (err, body) => {
      if (err) {
        console.error("Failed to read message", err);
      } else {
        if (this.stompTopics[topic]) {
          // Check for the custom topic first
          const actuators = this.stompTopics[topic];
          for (let index = 0; index < actuators.length; index++) {
            const actuator = actuators[index];
            actuator.updateActuatedData(body);
            actuator.showStatus();
          }
        } else {
          if (topic.startsWith(this.actuatedTopic)) {
            const subTopic = topic.replace(this.actuatedTopic, "");
            const array = subTopic.split("/");
            // find the actuator id in the subtopic
            for (let aIndex = 0; aIndex < this.actuators.length; aIndex++) {
              const actuator = this.actuators[aIndex];
              if (array.indexOf(actuator.id) > -1) {
                actuator.updateActuatedData(body);
                return actuator.showStatus();
              }
            }
            console.error(
              `[${this.thingId}] ERROR: cannot find the actuator ${array[4]}`
            );
          } else {
            console.log(`[${this.thingId}] Ignore message: `, topic, body);
          }
        }
      }
    });
  }

  /**
   * Override the @Thing.initThing() function to initialise the MQTT client
   * @param {Function} callback The callback function
   */
  initThing(callback, stompConfig) {
    this.stompConfig = stompConfig;
    const stompClient = stompit.connect(stompConfig, (err, client) => {
      if (err) {
        console.error(
          `[${this.thingId}] ERROR: cannot connect to STOMP broker`,
          err
        );
      } else {
        this.stompClient = stompClient;
        this.stompClient.subscribe(
          { destination: `${this.actuatedTopic}#` },
          (err2, message) => {
            if (err2) {
              console.error("Failed to read message", err2);
            } else {
              this.handleSTOMPMessage(message);
            }
          }
        );
        super.initThing(callback);
        this.setStatus(ONLINE);
      }
    });
  }

  /**
   * Process custom downstream topic of the actuator
   * @param {String} id The actuator id
   * @param {Object} options The options for actuator
   */
  addActuator(id, actuatorData, objectId = null) {
    if (!this.stompClient) {
      console.error(`[${this.thingId}] stompClient is not ready yet!`);
      return;
    }

    const newActuator = super.addActuator(id, actuatorData, objectId);
    this.stompClient.subscribe({destination: newActuator.topic},(err2, message) => {
      if (err2) {
        console.error("Failed to read message", err2);
      } else {
        message.ack();
        this.handleSTOMPMessage(message);
      }
    });
    if (!this.stompTopics[newActuator.topic]) {
      this.stompTopics[newActuator.topic] = [];
    }
    this.stompTopics[newActuator.topic].push(newActuator);
  }

  /**
   * Stop the simulation of this THING
   * @extends from Parent class
   */
  stop() {
    if (this.status === ONLINE || this.status === SIMULATING) {
      this.stompClient.disconnect();
    }
    super.stop();
  }

  /**
   * Override publish data function to publish data via mqtt channel
   * @param {Object} data Data to be published
   * @param {Object} sensor The publisher
   */
  publishData(data, sensor) {
    super.publishData(data,sensor);
    if (!data) return;
    let publishTopic = null;
    if (sensor.topic) {
      publishTopic = sensor.topic;
  } else {
    publishTopic = `things/${this.thingId}/sensors/${sensor.topicEnd}`;
  }
    console.log(`[${this.thingId}] Going to publish data on topic: ${topic}`, data);
    const frame = this.stompClient.send({destination: topic});
    frame.write(JSON.stringify(data));
    frame.end();
  }

  getStats() {
    const stats = super.getStats();
    const {host, port} = this.stompConfig;
    return {...stats, protocol: "STOMP", host, port};
  }
}

module.exports = ThingSTOMP;