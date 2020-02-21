const mqtt = require("mqtt");

/**
 * The Communication class presents a communication
 * - subscribe to channels
 * - publish data to channels
 * ThingComm:
 * - mqtt-broker-address
 * - subscribeURL: things/thing-id/sensors/#
 * - publishURL: things/thing-id/actuators/act-id
 * External Component:
 * - mqtt-broker-address
 * - subscribeURL
 * - publishURL
 */
class Communication {
  /**
   * Create a Communication instance
   * @param {String} id The identification of the comm
   * @param {Object} mqttConfig The configuration for create mqtt client
   * @param {Function} messageHandler The function to handle the arrived messages
   * - In a ThingComm, the arrived messages are the sensors data
   * - In a External Component, the arrived messages are the actuated data
   */
  constructor(id, mqttConfig, messageHandler) {
    this.id = id;
    this.mqttConfig = mqttConfig;
    this.mqttClient = null;
    this.messageHandler = messageHandler;
    this.subTopic = null;
  }
  /**
   * Establish the connection of this communication to a mqtt broker
   */
  initConnection(callback) {
    if (this.mqttClient) {
      return callback(this.mqttClient);
    }
    const mqttURL = `mqtt://${this.mqttConfig.HOST}:${this.mqttConfig.PORT}`
    let mqttClient = null;
    if (this.mqttConfig.options) {
      mqttClient = mqtt.connect(mqttURL, this.mqttConfig.options);
    } else {
      mqttClient = mqtt.connect(mqttURL);
    }
    mqttClient.on('connect', () => {
      console.log(`[${this.id}] has connected to ${mqttURL}`);
      this.mqttClient = mqttClient;
      callback(this.mqttClient);
    });

    mqttClient.on('message', (topic, message, packet) => {
      this.messageHandler(this.id, topic, message.toString(), packet);
    });
  }

  /**
   * Properly close a communication
   */
  close() {
    if (this.mqttClient) {
      if (this.subTopic) {
        this.mqttClient.unsubscribe(this.subTopic);
      }

      setTimeout(() => {
        this.mqttClient.close();
        console.log(`[${this.id}] has been closed!`);
      }, 1000);
    }
  }

  /**
   * subscribe to a mqtt broker channel
   * @param {String} topic The topic to be subscribe
   */
  subscribe(topic) {
    if (this.mqttClient) {
      this.mqttClient.subscribe(topic);
      this.subTopic = topic;
      console.log(`[${this.id}] has subscribed the topic ${topic}!`);
    } else {
      console.log(`[${this.id}] has not been initilized yet!`);
    }
  }

  /**
   * Publish a message to a channel
   * @param {String} topic topic to publish to
   * @param {String} message Mesasge to be published
   */
  publish(topic, message) {
    if (this.mqttClient) {
      this.mqttClient.publish(topic, message);
    } else {
      console.log(`[${this.id}] has not been initilized yet!`);
    }
  }
}

module.exports = Communication;