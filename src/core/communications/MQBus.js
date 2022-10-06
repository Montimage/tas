const MQTTBus = require('./MQTTBus');
const KafkaBus = require('./KafkaBus');

/**
 * MQBus class presents a Message Queue Bus interface
 * - supports multiple MQ protocols such as: MQTT, MQTTS, AMQP, AMQPS, etc.
 * - provides 4 simple APIs:
 *  + connect: connect to the MQ broker
 *  + subscribe: subscribe to a topic or a list of topic to receive data
 *  + publish: publish data to a topic
 *  + close: close the connection with the MQ broker
 */
class MQBus {
  constructor(config) {
    const {
      protocol,
      connConfig,
    } = config;
    this.protocol = protocol;
    this.connConfig = connConfig;
    this.mqClient = null;
    if (this.protocol === 'MQTT' || this.protocol === 'MQTTS') {
      this.mqClient = new MQTTBus(connConfig, protocol ? protocol.toLowerCase() : 'mqtt');
    } else if (this.protocol === 'Kafka') {
      this.mqClient = new KafkaBus(connConfig, protocol ? protocol.toLowerCase() : 'kafka');
    }
  }

  /**
   * Connect to the MQ broker 
   * @param {Function} callback The callback function
   */
  connect(callback) {
    this.mqClient.connect(callback);
  }

  /**
   * Setup the function to handle the receiving messages
   * @param {Function} msgHandlerFct The function to handle the received messages
   */
  setupMessageHandler(msgHandlerFct) {
    console.log('[MQBus]Going to setup message handler', msgHandlerFct);
    this.mqClient.setupMessageHandler(msgHandlerFct);
  }

  /**
   * Subscribe to a topic or a list of topics to receive data
   * @param {Array|String} topics The topics to be listening on
   */
  subscribe(topics) {
    console.log('[MQBus]Going to subscribe to topics: ',topics);
    if (typeof topics === 'string') {
      // single topic
      this.mqClient.subscribe(topics);
    } else if (topics && topics.length > 0) {
      // multiple topics
      for (let index = 0; index < topics.length; index++) {
        const topic = topics[index];
        this.mqClient.subscribe(topic);
      }
    }
  }
  /**
   * Unsubscribe to a topic or a list of topics
   * @param {Array|String} topics the topics to be unsubscribed
   */
  unsubscribe(topics) {
    console.log('[MQBus]Going to subscribe to topics: ',topics);
    if (typeof topics === 'string') {
      // single topic
      this.mqClient.unsubscribe(topics);
    } else if (topics && topics.length > 0) {
      // multiple topics
      for (let index = 0; index < topics.length; index++) {
        const topic = topics[index];
        this.mqClient.unsubscribe(topic);
      }
    }
  }
  /**
   * Publish a data to a topic  
   * @param {String} topic The topic to be published to
   * @param {Object} data The data to be published
   */
  publish(topic, data){
    this.mqClient.publish(topic, data);
  }

  /**
   * Close the connection with the MQ broker
   */
  close() {
    if (this.mqClient) this.mqClient.close();
  }
}

module.exports = MQBus;