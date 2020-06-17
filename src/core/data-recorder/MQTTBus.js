const mqtt = require("mqtt");
/**
 * MQTTBus is a wrapper for MQTT client
 */
class MQTTBus{
  constructor(host, port, options) {
    this.host = host;
    this.port = port;
    this.options = options;
    this.mqttClient = null;
    this.msgHandlerFct = null;
  }

  setupMessageHandler(msgHandlerFct) {
    console.log('[MQTTBus] Going to setup message handler', msgHandlerFct);
    this.msgHandlerFct = msgHandlerFct;
  }

  subscribe(topic) {
    if (this.mqttClient) {
      this.mqttClient.subscribe(topic);
      console.error('[MQTTBus] Subscribed to topic: ', topic);
    } else {
      console.error('[MQTTBus] ERROR: The MQTT Client has not been connected!');
    }
  }

  publish(topic, data) {
    this.mqttClient.publish(topic, JSON.stringify(data));
  }

  connect(callback) {
    const mqttBrokerURL = `mqtt://${this.host}:${this.port}`;
    let mqttClient = null;
    if (this.options) {
      mqttClient = mqtt.connect(mqttBrokerURL, this.options);
    } else {
      mqttClient = mqtt.connect(mqttBrokerURL);
    }

    mqttClient.on("connect", () => {
      console.log(
        `[MQTTBus] connected to MQTT broker ${mqttBrokerURL}`
      );
      this.mqttClient = mqttClient;
      return callback();
    });

    mqttClient.on("error", (err) => {
      console.error(
        `[MQTTBus] ERROR: cannot connect to MQTT broker`,
        err
      );
    });

    mqttClient.on("offline", (error) => {
      console.log(`[MQTTBus] gone offline!`, this.host, this.port, error);
    });

    mqttClient.on("message", (topic, message, packet) => {
      console.log(`[MQTTBus] received message on topic: ${topic}`);
      if(this.msgHandlerFct) {
        this.msgHandlerFct(topic, message.toString(), packet);
      }
    });
  }
}

module.exports = MQTTBus;