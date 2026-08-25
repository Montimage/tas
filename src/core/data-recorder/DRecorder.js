const MQBus = require('../communications/MQBus');
const { checkMQTTTopic } = require('../utils');
/**
 * DataRecorder class present a data recorder who have 3 functionalities:
 * - Listen data from a source (broker)
 * - Forwarder upstream data from the source to another destination (broker)
 * - Save the capturing data into a data storage (mongodb)
 */
class DataRecorder {
  constructor(drConfig, dataStorage, dataset, logger = null) {
    const { id, name, source, forward } = drConfig;
    this.id = id;
    this.name = name;
    // The source/forwarder configurations are never written to: the connected
    // buses used to be attached straight onto them (`source.mqClient`), and a
    // recorder started through the API echoes its model back in the response -
    // serialising a live bus (open sockets, timer handles) crashed
    // JSON.stringify and took the whole server down (issue #33). The buses
    // live on `this` instead.
    this.sourceConfig = source;
    this.forwardConfig = forward;
    this.sourceBus = null;
    this.forwardBus = null;
    this.dataStorage = dataStorage;
    this.dataset = dataset;
    // Where this run writes its log lines; defaults to the process console.
    this.logger = logger || console;
  }

  /**
   * Check if a message is a upstream message (data send from sensors to the system)
   * @param {String} _topic The topic of the receiving message
   * @param {Object} packet The attribute of the received message
   */
  isSensorData(_topic, packet) {
    const { upStreams } = this.sourceConfig;
    // Check by topic name
    for (let index = 0; index < upStreams.length; index++) {
      const topic = upStreams[index];
      if (checkMQTTTopic(_topic, topic)) return true;
    }
    return false;
  }

  /**
   * Handle the receiving messages
   * @param {String} topic The topic
   * @param {String} message The received message
   * @param {Object} packet Full attributes of the packets
   */
  messageHandler(topic, message, packet) {
    this.logger.log(`[DataRecorder] Received a message on topic: ${topic}`);
    // console.log(message);
    let isSensorData = false;
    if (this.isSensorData(topic, packet)) {
      isSensorData = true;
      // Forward message, keep the original topic name
      if (this.forwardBus) {
        this.forwardBus.publish(topic, message);
      }
    }

    // Save data into database

    if (this.dataStorage) {
      this.dataStorage.dsClient.saveEvent({
        datasetId: this.dataset.id,
        topic,
        isSensorData,
        timestamp: Date.now(),
        values: message,
      });
    }
  }

  /**
   * Support diffirent protocols: MQTT, AMQP, etc..
   * Listen on several topics/channels
   * @param {Object} sourceConfig the configuration of the source
   * "source": {
        "protocol": "MQTT",
        "connConfig": {
            "host": "localhost",
            "port": 1883,
            "options": null
        },
        "upStreams": [
            "enact/sensors/*",
            "enact/sensors/temp-01"
        ],
        "downStreams":[
            "enact/actuators/*",
            "enact/actuators/heating-01"
        ]
    },
   */
  /**
   * Initilize the source of the data recorder
   * - connect to the source broker
   * - subscribe to the register topics
   */
  initSource() {
    const { upStreams, downStreams } = this.sourceConfig;
    // Init source
    const mqClient = new MQBus(this.sourceConfig);
    // Setup message handler
    mqClient.setupMessageHandler((topic, message, packet) =>
      this.messageHandler(topic, message, packet)
    );
    // Connect to the broker
    mqClient.connect(() => {
      // subscribe topics
      if (upStreams) {
        mqClient.subscribe(upStreams);
      }
      if (downStreams) {
        mqClient.subscribe(downStreams);
      }
    });
    // Keep the live bus off the caller's configuration object.
    this.sourceBus = mqClient;
  }

  /**
   *
   * @param {Object} fwConfig the configuration of the forwarder
   * "forward": {
        "protocol": "MQTT",
        "connConfig": {
            "host": "localhost",
            "port": 1883,
            "options": null
        }
    },
   */
  /**
   * Initialise the forwarder
   * - connect to the new broker
   * @param {Function} callback the callback function
   */
  initForwarder(callback) {
    const fw = new MQBus(this.forwardConfig);
    fw.connect(() => {
      this.forwardBus = fw;
      return callback();
    });
  }

  /**
   * Initialise the Data Recorder
   * - First initialise the forwarder
   * - Then initialise the Data storage
   * - And finally initialise the Source
   */
  init() {
    // Check source
    if (!this.sourceConfig) {
      this.logger.error('[DataRecorder] Source is not found!');
      return false;
    }

    // Check output
    if (!this.forwardConfig) {
      this.logger.warn('[DataRecorder] forward are not found!');
      this.initSource();
    } else {
      // Init the forwarder
      this.initForwarder(() => {
        this.logger.error('[DataRecorder] Forwarder has been created!', this.forwardConfig);
        this.initSource();
      });
    }
    return true;
  }

  /**
   * Properly stop the Data Recorder
   * - Stop the source
   * - Stop the forwarder
   * - Stop the data storage
   */
  stop() {
    if (this.sourceBus) {
      this.sourceBus.close();
    }
    if (this.forwardBus) {
      this.forwardBus.close();
    }
  }
}

module.exports = DataRecorder;
