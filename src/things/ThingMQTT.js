const mqtt = require("mqtt");
const Thing = require('./Thing');
const {
  ONLINE,
  OFFLINE,
  SIMULATING,
} = require('../constants');
/**
 * The Thing class presents a THING component:
 * - List of sensors
 * - List of actuators
 * - Possibility to communicate with a gateway
 *  + send data - to multiple channels: `things/thing-id/sensors/sensor-id`
 *  + receive data - listen to multiple channels: `things/thing-id/actuators/#`
 */
class ThingMQTT extends Thing {
  constructor(id) {
    super(id);
    this.mqttClient = null;
    this.actuatedTopic = `things/${id}/actuators/`;
  }

  /**
   * handle actuated data
   * @param {String} topic topic of the received packet
   * @param {String} message payload of the received packet
   * @param {Object} packet received packet, as defined in mqtt-packet
   */
  handleMQTTMessage (topic, message, packet) {
    if (topic.startsWith(this.actuatedTopic)) {
      const subTopic = topic.replace(this.actuatedTopic,'');
      const array = subTopic.split('/');
      // find the actuator id in the subtopic
      for (let aIndex = 0; aIndex < this.actuators.length; aIndex++) {
        const actuator = this.actuators[aIndex];
        if (array.indexOf(actuator.id) > -1) {
          actuator.updateActuatedData(message);
          return actuator.showStatus();
        }
      }
      console.error(`[${this.id}] ERROR: cannot find the actuator ${array[4]}`);
    } else {
      console.log(`[${this.id}] Ignore message: `, topic, message);
    }
  }

  /**
   * Override the @Thing.initThing() function to initialise the MQTT client
   * @param {Function} callback The callback function
   */
  initThing(callback, mqttConfig) {
      const mqttBrokerURL = `mqtt://${mqttConfig.HOST}:${mqttConfig.PORT}`;
      let mqttClient = null;
      if (mqttConfig.options) {
        mqttClient = mqtt.connect(mqttBrokerURL, mqttConfig.options);
      } else {
        mqttClient = mqtt.connect(mqttBrokerURL);
      }

      mqttClient.on('connect', () => {
        console.log(`[${this.id}] connected to MQTT broker ${mqttBrokerURL}`);
        this.mqttClient = mqttClient;
        this.setStatus(ONLINE);
        // Subscribe to get the downstream data for actuators
        this.mqttClient.subscribe(`${this.actuatedTopic}#`);
        console.log(`[${this.id}] listening actuated data on channel: ${this.actuatedTopic}#`);
        super.initThing(callback);
      });

      mqttClient.on('error', (err) => {
        console.error(`[${this.id}] ERROR: cannot connect to MQTT broker`, err);
      });

      mqttClient.on('offline', () => {
        console.log(`[${this.id}] gone offline!`);
        this.setStatus(OFFLINE);
      });

      mqttClient.on('message', (topic, message, packet) => {
        // console.log(`[Thing ${this.id}] received message on topic: ${topic}`);
        this.handleMQTTMessage(topic, message.toString(), packet);
      });
  }

  /**
   * Stop the simulation of this THING
   * @extends from Parent class
   */
  stop() {
    if (this.status === ONLINE || this.status === SIMULATING) {
      this.mqttClient.end();
    }
    super.stop();
  }

  /**
   * Override publish data function to publish data via mqtt channel
   * @param {Object} data Data to be published
   * @param {String} publishID The ID of the publisher
   */
  publishData(data, publishID) {
    // super.publishData(data,publishID);
    const topic = `things/${this.id}/sensors/${publishID}`;
    console.log(`[${this.id}] Going to publish data on topic: ${topic}`, data);
    this.mqttClient.publish(topic, JSON.stringify(data));
  }
}

module.exports = ThingMQTT;