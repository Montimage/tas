const kafka = require("kafkajs");
/**
 * KafkaBus is a wrapper for KafkaJS client
 */
class KafkaBus{
  constructor(connConfig, protocol) {
    this.connConfig = {...connConfig, protocol};
    if (protocol === 'kafka') {
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
    console.log('[KafkaBus] Going to setup message handler', msgHandlerFct);
    // this.msgHandlerFct = msgHandlerFct;
  }

  subscribe(topic) {
    if (this.mqttClient) {
      console.log('[KafkaBus] Subscribed to topic: ', topic);
    //   this.mqttClient.subscribe(topic);
    } else {
      console.error('[KafkaBus] ERROR: The KafkaJS Client has not been connected!');
    }
  }
  
  unsubscribe(topic) {
    if (this.mqttClient) {
      console.log('[KafkaBus] Unsubscribed to topic: ', topic);
    //   this.mqttClient.unsubscribe(topic);
    } else {
      console.error('[KafkaBus] ERROR: The MQTT Client has not been connected!');
    }
  }

  publish(topic, data) {
    console.log('[KafkaBus] Unsubscribed to topic: ', topic);
/*     let reportedData = data;
    if (typeof data !=="string") {
      reportedData = JSON.stringify(data);
    }
    this.mqttClient.publish(topic, reportedData); */
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
        `[MQTTBus] ERROR: cannot connect to MQTT broker`
      );
      console.error(err);
    });

    mqttClient.on("offline", (error) => {
      console.log(`[MQTTBus] gone offline! ${this.connConfig.host}:${this.connConfig.port}`);
      console.error(error);
    });

    mqttClient.on("message", (topic, message, packet) => {
      console.log(`[MQTTBus] received message on topic: ${topic}`);
      if(this.msgHandlerFct) {
        this.msgHandlerFct(topic, message.toString(), packet);
      }
    });
  }
  close() {
    console.log('[KafkaBus] Close the connection');
    // if (this.mqttClient) this.mqttClient.end();
  }
}

module.exports = KafkaBus;