const MQBus = require('../communications/MQBus');
const DataStorage = require('../communications/DataStorage');
/**
 * DataRecorder class present a data recorder who have 3 functionalities:
 * - Listen data from a source (broker)
 * - Forwarder upstream data from the source to another destination (broker)
 * - Save the capturing data into a data storage (mongodb)
 */
class DataRecorder {
  constructor(drConfig) {
    const {
      id,
      name,
      source,
      forward,
      dataStorage
    } = drConfig;
    this.id = id;
    this.name = name;
    this.source = source;
    this.forwarder = forward;
    this.dataStorage = dataStorage;
  }

  /**
   * Check if a message is a upstream message (data send from sensors to the system)
   * @param {String} _topic The topic of the receiving message
   * @param {Object} packet The attribute of the received message
   */
  isSensorData(_topic, packet) {
    const {
      upStreams
    } = this.source;
    // Check by topic name
    for (let index = 0; index < upStreams.length; index++) {
      const topic = upStreams[index];
      const reg = new RegExp(topic);
      if (reg.test(_topic)) return true;
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
    console.log(`[DataRecorder] Received a message on topic: ${topic}`);
    console.log(message);
    let isSensorData = false;
    if (this.isSensorData(topic, packet)) {
      isSensorData = true;
      // Forward message, keep the original topic name
      if (this.forwarder) {
        this.forwarder.mqClient.publish(topic, message);
      }
    }

    // Save data into database
    
    if (this.dataStorage) {
      this.dataStorage.dsClient.saveEvent({
        datasetId: this.dataStorage.dataset.id,
        topic,
        isSensorData,
        timestamp: Date.now(),
        values: message
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
    const {
      upStreams,
      downStreams
    } = this.source;
    // Init source
    const mqClient = new MQBus(this.source);
    // Setup message handler
    mqClient.setupMessageHandler((topic, message, packet) => this.messageHandler(topic, message, packet));
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
    // Save the configuration
    this.source['mqClient'] = mqClient;
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
    const fw = new MQBus(this.forwarder);
    fw.connect(() => {
      this.forwarder['mqClient'] = fw;
      return callback();
    });
  }

  /**
   * 
   * @param {Object} dsConfig the configuration of the data storage
   * "dataStorage": {
        "protocol": "MONGODB",
        "connConfig": {
            "host": "localhost",
            "port": 27017,
            "username": null,
            "password": null,
            "dbname": "tasdb",
            "options": null
        },
        "dataset": {
            "id": "new-data-set",
            "name": "New Data Set",
            "description": "Dataset descriptions",
            "tags": ["recorded","random"]
        }
    }
   */
  /**
   * Initialise the Data storage
   * - Connect to the database
   * @param {Function} callback The callback function
   */
  initDataStorage(callback) {
    const dsClient = new DataStorage(this.dataStorage);
    dsClient.connect(error => {
      if (error) {
        console.error('Failed to create DataStorage', error);
        return callback(error);
      } else {
        this.dataStorage['dsClient'] = dsClient;
        if (this.dataStorage.dataset) {
          dsClient.saveDataset(this.dataStorage.dataset);
          return callback();
        } else {
          console.error('Failed to create DataStorage: dataset missing');
          dsClient.stop();
          return callback('Dataset missing');
        }
      }
    });
  }

  /**
   * Initialise the Data Recorder
   * - First initialise the forwarder
   * - Then initialise the Data storage
   * - And finally initialise the Source
   */
  initDataRecorder() {
    // Check source
    if (!this.source) {
      console.error('[DataRecorder] Source is not found!');
      return false;
    }

    // Check output
    if (!this.forwarder && !this.dataStorage) {
      console.error('[DataRecorder] forward and data storage are not found!');
      return false;
    }

    if (this.forwarder) {
      // Init the forwarder
      this.initForwarder(() => {
        console.error('[DataRecorder] Forwarder has been created!', this.forwarder);
        if (this.dataStorage) {
          // Init the data storage
          this.initDataStorage((err) => {
            if (!err) {
              console.error('[DataRecorder] Data Storage has been created!', this.dataStorage);
              // Init the source
              this.initSource();
            }
          });
        } else {
          // Init the source - without datastorage
          this.initSource();
        }
      });
    } else {
      // - without forwarder
      if (this.dataStorage) {
        // Init the data storage
        this.initDataStorage((err) => {
          if (!err) {
            console.error('[DataRecorder] Data Storage has been created!', this.dataStorage);
            // Init the source
            this.initSource();
          }
        });
      }
    }
  }

  /**
   * Properly stop the Data Recorder
   * - Stop the source
   * - Stop the forwarder
   * - Stop the data storage
   */
  stop() {
    if (this.source && this.source.mqClient) {
      this.source.mqClient.close();
    }
    if (this.forwarder && this.forwarder.mqClient) {
      this.forwarder.mqClient.close();
    }

    if (this.dataStorage && this.dataStorage.dsClient) {
      this.dataStorage.dsClient.stop();
    }
  }
}

module.exports = DataRecorder;