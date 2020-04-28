const mqtt = require("mqtt");
const Thing = require("./Thing");
const { ONLINE, OFFLINE, SIMULATING } = require("../DeviceStatus");
/**
 * The Thing class presents a THING component:
 * - List of sensors
 * - List of actuators
 * - Possibility to communicate with a gateway
 *  + send data - to multiple channels: `things/thing-id/sensors/sensor-id`
 *  + receive data - listen to multiple channels: `things/thing-id/actuators/#`
 */
class ThingMQTT extends Thing {
  constructor(thingId) {
    super(thingId);
    this.mqttClient = null;
    this.mqttTopics = {};
    this.actuatedTopic = `things/${thingId}/actuators/`;
  }

  /**
   * handle actuated data
   * @param {String} topic topic of the received packet
   * @param {String} message payload of the received packet
   * @param {Object} packet received packet, as defined in mqtt-packet
   */
  handleMQTTMessage(topic, message, packet) {
    console.log(
      `[${this.thingId}] received: ${this.mqttClient.options.href} ${topic}`,
      message
    );
    if (this.mqttTopics[topic]) {
      // Check for the custom topic first
      const actuators = this.mqttTopics[topic];
      for (let index = 0; index < actuators.length; index++) {
        const actuator = actuators[index];
        actuator.updateActuatedData(message);
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
            actuator.updateActuatedData(message);
            return actuator.showStatus();
          }
        }
        console.error(
          `[${this.thingId}] ERROR: cannot find the actuator ${array[4]}`
        );
      } else {
        console.log(`[${this.thingId}] Ignore message: `, topic, message);
      }
    }
  }

  /**
   * Override the @Thing.initThing() function to initialise the MQTT client
   * @param {Function} callback The callback function
   */
  initThing(callback, mqttConfig) {
    const mqttBrokerURL = `mqtt://${mqttConfig.host}:${mqttConfig.port}`;
    let mqttClient = null;
    if (mqttConfig.options) {
      mqttClient = mqtt.connect(mqttBrokerURL, mqttConfig.options);
    } else {
      mqttClient = mqtt.connect(mqttBrokerURL);
    }

    mqttClient.on("connect", () => {
      console.log(
        `[${this.thingId}] connected to MQTT broker ${mqttBrokerURL}`
      );
      this.mqttClient = mqttClient;
      this.setStatus(ONLINE);
      // Subscribe to get the downstream data for actuators
      this.mqttClient.subscribe(`${this.actuatedTopic}#`);
      console.log(
        `[${this.thingId}] listening actuated data on channel: ${this.actuatedTopic}#`
      );
      super.initThing(callback);
    });

    mqttClient.on("error", (err) => {
      console.error(
        `[${this.thingId}] ERROR: cannot connect to MQTT broker`,
        err
      );
    });

    mqttClient.on("offline", () => {
      console.log(`[${this.thingId}] gone offline!`);
      this.setStatus(OFFLINE);
    });

    mqttClient.on("message", (topic, message, packet) => {
      // console.log(`[${this.thingId}] received message on topic: ${topic}`);
      this.handleMQTTMessage(topic, message.toString(), packet);
    });
  }

  /**
   * Process custom downstream topic of the actuator
   * @param {String} id The actuator id
   * @param {Object} options The options for actuator
   */
  addActuator(id, actuatorData, objectId = null) {
    const newActuator = super.addActuator(id, actuatorData, objectId);
    if (!this.mqttClient) {
      console.error(`[${this.thingId}] mqttClient is not ready yet!`);
      return;
    }

    this.mqttClient.subscribe(newActuator.topic);
    if (!this.mqttTopics[newActuator.topic]) {
      this.mqttTopics[newActuator.topic] = [];
    }
    this.mqttTopics[newActuator.topic].push(newActuator);
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
   * @param {Object} sensor The publisher
   */
  publishData(data, sensor) {
    if (!data) return ;
    let publishTopic = null;
    if (sensor.topic) {
        publishTopic = sensor.topic;
    } else {
      publishTopic = `things/${this.thingId}/sensors/${sensor.topicEnd}`;
    }
    console.log(
      `[${this.thingId}] published: ${this.mqttClient.options.href} ${publishTopic}`,
      data
    );
    this.mqttClient.publish(publishTopic, JSON.stringify(data));
  }
}

module.exports = ThingMQTT;
