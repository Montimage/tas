const mqtt = require("mqtt");
/**
 * MQTTBus is a wrapper for MQTT client
 */
class MQTTBus{
  constructor(connConfig, protocol) {
    this.connConfig = {...connConfig, protocol};
    if (protocol === 'mqtt') {
      this.connConfig.ca = null;
      this.connConfig.cert = null;
      this.connConfig.key = null;
    } else {
      this.connConfig['rejectUnauthorized'] = false;
    }
    this.mqttClient = null;
    this.msgHandlerFct = null;
  }

  setupMessageHandler(msgHandlerFct) {
    // console.log('[MQTTBus] Going to setup message handler', msgHandlerFct);
    this.msgHandlerFct = msgHandlerFct;
  }

  subscribe(topic) {
    if (this.mqttClient) {
      console.log(`[MQTTBus] Subscribed to topic: ${topic}`);
      this.mqttClient.subscribe(topic);
    } else {
      console.error('[MQTTBus] ERROR: The MQTT Client has not been connected!');
    }
  }

  unsubscribe(topic) {
    if (this.mqttClient) {
      console.log(`[MQTTBus] Unsubscribed to topic: ${topic}`);
      this.mqttClient.unsubscribe(topic);
    } else {
      console.error('[MQTTBus] ERROR: The MQTT Client has not been connected!');
    }
  }

  publish(topic, data) {
    let reportedData = data;
    if (typeof data !=="string") {
      reportedData = JSON.stringify(data);
    }
    this.mqttClient.publish(topic, reportedData);
  }

  connect(callback) {
    let mqttClient = null;
    mqttClient = mqtt.connect(this.connConfig);

    mqttClient.on("connect", () => {
      console.log(
        `[MQTTBus] connected to MQTT broker ${this.connConfig.host}:${this.connConfig.port}`
      );
      this.mqttClient = mqttClient;
      return callback();
    });

    mqttClient.on("error", (err) => {
      console.error(
        `[MQTTBus] ERROR: cannot connect to MQTT broker ${JSON.stringify(err)}`
      );
    });

    mqttClient.on("offline", (error) => {
      console.log(`[MQTTBus] gone offline! ${this.connConfig.host}:${this.connConfig.port}`);
      console.error(error);
    });

    mqttClient.on("message", (topic, message, packet) => {
      // console.log(`[MQTTBus] received message on topic: ${topic}`);
      if(this.msgHandlerFct) {
        this.msgHandlerFct(topic, message.toString(), packet);
      }
    });
  }
  close() {
    if (this.mqttClient) this.mqttClient.end();
  }
}

module.exports = MQTTBus;