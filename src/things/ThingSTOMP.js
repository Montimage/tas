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
  }

  /**
   * handle actuated data
   * @param {String} topic topic of the received packet
   * @param {String} message payload of the received packet
   * @param {Object} packet received packet, as defined in mqtt-packet
   */
  handleSTOMPMessage(message) {
    // this.stompClient.ack(message); // ack message
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
  addActuator(id, options) {
    const newActuator = super.addActuator(id, options);
    if (options && options.topic) {
      if (!this.stompClient) {
        console.error(`[${this.thingId}] stompClient is not ready yet!`);
      } else {
        this.stompClient.subscribe({destination: options.topic},(err2, message) => {
          if (err2) {
            console.error("Failed to read message", err2);
          } else {
            message.ack();
            this.handleSTOMPMessage(message);
          }
        });
        if (!this.stompTopics[options.topic]) {
          this.stompTopics[options.topic] = [];
        }
        this.stompTopics[options.topic].push(newActuator);
      }
    }
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
   * @param {String} publishID The ID of the publisher
   */
  publishData(data, publishID) {
    if (!data) return;
    // super.publishData(data,publishID);
    let topic = null;
    if (options && options.topic) {
      topic = options.topic;
      // console.log('custom topic: ', topic);
    } else {
      topic = `things/${this.thingId}/sensors/${publishID}`;
    }
    console.log(`[${this.thingId}] Going to publish data on topic: ${topic}`, data);
    const frame = this.stompClient.send({destination: topic});
    frame.write(JSON.stringify(data));
    frame.end();
  }
}

module.exports = ThingSTOMP;