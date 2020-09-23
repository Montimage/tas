const Actuator = require('../actuators');
const Sensor = require('../sensors');
const {
  ONLINE,
  OFFLINE,
  SIMULATING,
} = require('../DeviceStatus');
const MQBus = require('../communications/MQBus');
const DataStorage = require('../communications/DataStorage');
const {
  DS_RECORDER,
  DS_DATASET,
  DS_DATA_GENERATOR
} = require('../DataSourceType');

const findDevice = (id, objectId, array) => {
  for (let index = 0; index < array.length; index++) {
    const element = array[index];
    if (element.id === id && objectId === element.objectId) return index;
  }
  return -1;
};

let startReplayingTime = Date.now();
console.log('startReplayingTime: ', startReplayingTime);
/**
 * The Device class presents a Device component:
 * - List of sensors
 * - List of actuators
 * - Possibility to communicate with a gateway
 *  + send data - to multiple channels: `devices/device-id/sensors/sensor-id`
 *  + receive data - listen to multiple channels: `devices/device-id/actuators/#`
 */
class Device {
  /**
   * Create a Device
   * @param {Object} configs The configuration to create a Device
   * @param {Object} dataStorage The information to establish the data connection with Data storage
   * @param {String} datasetId The dataset id of the data source
   * @param {Object} newDataset The information of the new dataset which keeps the traces of this simulation
   */
  constructor(configs, dataStorage, datasetId, replayOptions, newDataset, report, isFirstDevice = false) {
    const {
      id,
      name,
      behaviours,
      timeToFailed,
      testBroker,
      productionBroker,
      sensors,
      actuators
    } = configs;
    // Configuration to create a Device
    this.id = id;
    this.name = name;
    this.behaviours = behaviours; // The behaviours of the gateway have to be defined from beginning
    this.timeToFailed = timeToFailed;
    this.testBrokerConfig = testBroker;
    this.productionBrokerConfig = productionBroker;
    this.sensorsConfig = sensors;
    this.actuatorsConfig = actuators;
    this.dataStorageConfig = dataStorage;
    this.newDatasetConfig = newDataset;
    this.report = report;
    this.datasetId = datasetId;
    this.globalReplayOptions = replayOptions;
    this.isFirstDevice = isFirstDevice;
    this.status = OFFLINE; // OFFLINE | ONLINE | SIMULATING | PAUSE | STOP
    // Instance need to be initialized
    this.sensors = []; // Add/Remove sensor method
    this.actuators = []; // Add/Remove actuator method
    this.testBroker = null; // The communication to publish the sensors data and receive the actuators data - cannot be null
    this.productionBroker = null; // The communication to collecting data in digitalTwins option - can be null
    this.dataStorage = null; // The connection with Data Storage to get the dataset or save the new dataset - can be null, in this case the simulated data will not be stored in the data storage, and the option simulate from a dataset will be disable
    // Statstics
    this.numberOfSentData = 0; // Number sensors data sent by this device
    this.numberOfReceivedData = 0; // Number of actuators data received by this device
    this.numberOfForwardedData = 0; // Number of message data that this device has received and forward in the digitalTwins option
    this.startedTime = 0;
    this.lastActivity = Date.now();
  }

  /**
   * Get statistics of the simulation of current device
   */
  getStats() {
    const sensorStats = [];
    if (this.sensors) {
      for (let index = 0; index < this.sensors.length; index++) {
        const sensor = this.sensors[index];
        const stats = sensor.getStats();
        if (stats) sensorStats.push(stats);
      }
    }

    const actuatorStats = [];
    if (this.actuators) {
      for (let index = 0; index < this.actuators.length; index++) {
        const actuator = this.actuators[index];
        const stats = actuator.getStats();
        if (stats) actuatorStats.push(stats);
      }
    }

    return {
      id: this.id,
      name: this.name,
      status: this.status,
      numberOfSensors: this.sensors.length,
      numberOfActuators: this.actuators.length,
      numberOfSentData: this.numberOfSentData,
      numberOfReceivedData: this.numberOfReceivedData,
      numberOfForwardedData: this.numberOfForwardedData,
      startedTime: this.startedTime,
      lastActivity: this.lastActivity,
      sensorStats,
      actuatorStats
    }
  }

  /**
   * Publish a data to the test broker (sensor's data)
   * - Store the data into the data storage
   * - publish the data to the test broker
   * - Update statistics
   * @param {String} topic The topic to publish data to
   * @param {Object} data The data to be published
   */
  publishDataToTestBroker(topic, data) {
    const currentTime = Date.now();
    for (let index = 0; index < this.sensors.length; index++) {
      const sensor = this.sensors[index];
      if (sensor.topic === topic) {
        // publish data to the test broker
        this.testBroker.publish(topic, data);
        // store data into the data storage
        if (this.dataStorage) {
          const event = {
            timestamp: currentTime,
            topic,
            datasetId: this.newDatasetConfig.id,
            isSensorData: true,
            values: data
          };
          this.dataStorage.saveEvent(event);
        }
        // Update statistics
        this.lastActivity = currentTime;
        this.numberOfSentData++;
        return;
      }
    }
    console.error('Cannot find the sensor with the topic: ', topic);
  }

  /**
   * Handle the received data from test broker, which is the data to be sent to actuators
   * - Store the message into the data storage (if needed)
   * - update the actuator value
   * - update the statistics
   * @param {String} topic Topic of the receive message
   * @param {Object} message received message
   * @param {Object} packet Packet
   */
  testBrokerMessagehandler(topic, message, packet) {
    const currentTime = Date.now();
    // Update the actuator value
    for (let index = 0; index < this.actuators.length; index++) {
      const actuator = this.actuators[index];
      if (actuator.topic === topic) {
        actuator.updateActuatedData(message, currentTime);
        // store data into the data storage
        if (this.dataStorage) {
          const event = {
            timestamp: currentTime,
            topic,
            devId: actuator.id,
            datasetId: this.newDatasetConfig.id,
            isSensorData: false,
            values: data
          };
          this.dataStorage.saveEvent(event);
        }

        // Update statistics
        this.lastActivity = currentTime;
        this.numberOfReceivedData++;
        return;
      }
    }
    console.error('Cannot find the actuator with the topic: ', topic);
  }

  /**
   * Handl the received data from production environment, then forward to the testing environment (DigitalTwins)
   * - forward to test broker
   * - update statistics
   * @param {String} topic Topic of the receive message
   * @param {Object} message received message
   * @param {Object} packet Packet
   */
  productionBrokerMessageHandler(topic, message, packet) {
    // find the sensor by topic - publisher
    for (let index = 0; index < this.sensors.length; index++) {
      const sensor = this.sensors[index];
      if (sensor.topic === topic) {
        this.publishDataToTestBroker(topic, message);
        // Update the statistics
        this.numberOfForwardedData++;
        return;
      }
    }
    console.error('Cannot find the sensor with the topic: ', topic);
  }

  /**
   * Get status of the Device
   */
  getStatus() {
    return this.status;
  }

  /**
   * Set new status of the Device
   * @param {String} newStatus New status: OFFLINE | ONLINE | SIMULATING | PAUSE | STOP
   */
  setStatus(newStatus) {
    this.status = newStatus;
  }

  /**
   * Add a new Sensor into the current Device
   * The sensor collect the data (generate randomly or from database) and publish the data to the gateway via mqtt broker
   * - Check if the device has been existed already
   * - Check if the dataSource of the sensor is from productionBroker -> subscribe to get the data
   * @param {String} id ID of the sensor
   * @param {Object} sensorData Sensor data
   * @param {String} objectId The object id of the sensor follow IP Smart Object Standard
   */
  addSensor(id, sensorData, objectId = null) {
    if (findDevice(id, objectId, this.sensors) > -1) {
      console.error(`[${this.id}] Sensor ID ${id} ${objectId} has already existed!`);
      return null;
    }
    let topic = sensorData.topic;
    let replayOptions = sensorData.replayOptions;
    if (!replayOptions) {
      replayOptions = this.globalReplayOptions;
    }
    const {
      dataSource
    } = sensorData;
    if (!topic) {
      topic = `devices/${this.id}/sensors/${id}`;
      console.log(`[${this.id}] Sensor ${id} will use the default topic name`, topic);
    }

    if (dataSource === DS_RECORDER) {
      // Data source from a real system
      if (this.productionBroker) {
        // this.productionBroker.subscribe(topic);
        const newSensor = new Sensor(id, {
          ...sensorData,
          topic: topic
        }, this.productionBroker);
        this.sensors.push(newSensor);
        // HOT reload sensor
        if (this.status === SIMULATING) {
          this.sensors[this.sensors.length - 1].start();
        }
        console.log(`[${this.id}] added new sensor ${id} ${objectId} (${dataSource})`);
      } else {
        console.error(`[${this.id}] Cannot create a sensor! Missing data source from production broker`);
        return null;
      }
    } else if (dataSource === DS_DATASET) {
      // Data source from a database
      if (!this.datasetId) {
        console.error(`[${this.id}] Cannot create a sensor! Missing datasetId`);
        return null;
      }
      let startTime = 0;
      let endTime = Date.now();
      if (replayOptions) {
        if (replayOptions.startTime) startTime = replayOptions.startTime;
        if (replayOptions.endTime) endTime = replayOptions.endTime;
      }

      this.dataStorage.getEvents(topic, this.datasetId, {
        startTime,
        endTime
      }, (err, events) => {
        if (err) {
          console.error(`[${this.id}] Cannot create a sensor! Failed to get events data`, err);
          return null;
        } else if (!events || events.length === 0) {
          console.error(`[${this.id}] Cannot create a sensor! No events data ${id}, ${topic}, ${this.datasetId}`);
          return null;
        }
        if (startTime === 0) startTime = events[0].timestamp;
        if (startReplayingTime > startTime) {
          startReplayingTime = startTime - 1000; // back 1s
          // Update for other sensors
          this.sensors.map(s => s.updateStartReplayingTime(startReplayingTime));
        }
        const newSensor = new Sensor(id, {
          ...sensorData,
          replayOptions,
          topic: topic
        }, null, (topic, message) => {
          this.publishDataToTestBroker(topic, message);
        }, events, startReplayingTime);
        this.sensors.push(newSensor);
        // HOT reload sensor
        if (this.status === SIMULATING) {
          this.sensors[this.sensors.length - 1].start();
        }
        console.log(`[${this.id}] added new sensor ${id} ${objectId} (${dataSource})`);
      });
    } else {
      // Data will be generated in run time
      const newSensor = new Sensor(id, {
        ...sensorData,
        topic: topic
      }, null, (topic, message) => {
        this.publishDataToTestBroker(topic, message);
      });

      this.sensors.push(newSensor);
      // HOT reload sensor
      if (this.status === SIMULATING) {
        this.sensors[this.sensors.length - 1].start();
      }
      console.log(`[${this.id}] added new sensor ${id} ${objectId} (${dataSource})`);
    }
  }

  /**
   * Remove a sensor from device
   * - find the device
   * - stop the simulation
   * - unsubscribe to the production broker - if needed
   * - remove from the list 
   * @param {String} id The id of the sensor to be removed
   * @param {String} objectId The object id of the sensor to be removed
   */
  removeSensor(id, objectId = null) {
    const sensorIndex = findDevice(id, objectId, this.sensors);
    if (sensorIndex === -1) {
      console.error(`[${this.id}] Sensor ID ${id} ${objectId} does not exist!`);
      return null;
    }
    const sensor = this.sensors[sensorIndex];
    if (this.status === SIMULATING) {
      sensor.stop();
    }
    if (this.productionBroker) {
      if (sensor.dataSource === DS_RECORDER) {
        this.productionBroker.unsubscribe(sensor.topic);
      }
    }
    this.sensors.splice(sensorIndex, 1);
    console.log(`[${this.id}] Sensor ID ${id} ${objectId} has been removed!`);
  }

  /**
   * Add a new Actuator into the current Device
   * The actuator receives the acuated data from the gateway and printout the status
   * - find the device
   * - subscribe the actuator's topic to testBroker
   * - Add to the list of actuator
   * @param {String} id The actuator's ID
   */
  addActuator(id, actuatorData, objectId = null) {
    if (findDevice(id, objectId, this.actuators) > -1) {
      console.error(`[${this.id}] Actuator ID ${id} ${objectId} has already existed!`);
      return null;
    }
    let topic = actuatorData.topic;
    if (!topic) {
      topic = `devices/${this.id}/actuators/${id}`;
      console.log(`[${this.id}] Actuator ${id} will use the default topic name`, topic);
    }
    // subscribe to testBroker
    // this.testBroker.subscribe(topic);
    const newActuator = new Actuator(id, {
      ...actuatorData,
      topic: topic
    });
    this.actuators.push(newActuator);
    console.log(`[${this.id}] added new actuator ${id} ${objectId}`);

    return newActuator;
  }

  /**
   * Remove a actuator from device
   * - Find the actuator by id (& objectId)
   * - unsubscribe the subscription with testBroker
   * - stop simulating
   * - remove from the list of actuator
   * @param {String} id The id of the actuator to be removed
   * @param {String} objectId The object id of the actuator to be removed
   */
  removeActuator(id, objectId = null) {
    const actuatorIndex = findDevice(id, objectId, this.actuators);
    if (actuatorIndex === -1) {
      console.error(`[${this.id}] Actuator ID ${id} ${objectId} does not exist!`);
      return null;
    }
    const actuator = this.actuators[actuatorIndex];
    // unsubscribe the subscription with testBroker
    this.testBroker.unsubscribe(actuator.topic);
    if (this.status === SIMULATING) {
      actuator.stop();
    }
    this.actuators.splice(actuatorIndex, 1);
    console.log(`[${this.id}] Actuator ID ${id} ${objectId} has been removed!`);
  }

  /**
   * Initialise the Device
   * @param {Function} callback The callback function
   */
  initDevice(callback) {
    // Init testBroker
    // Init Data Storage - can be null
    // Init productionBroker - if needed
    // Init new Dataset if needed
    // Add sensors
    // Add actuators
    console.log(`[${this.id}] initializing...`);
    if (this.testBrokerConfig) {
      this.testBroker = new MQBus(this.testBrokerConfig);
      this.testBroker.connect((err) => {
        if (err) {
          console.error('Failed to init the testBroker: ', err);
          return callback(err);
        }
        console.log(`[${this.id}] Connected with test broker`);
        this.testBroker.setupMessageHandler((topic, message, packet) => this.testBrokerMessagehandler(topic, message, packet));
        if (this.productionBrokerConfig) {
          this.productionBroker = new MQBus(this.productionBrokerConfig);
          this.productionBroker.connect((err2) => {
            if (err2) {
              console.error('Failed to init production broker', err2);
            } else {
              console.log(`[${this.id}] Connected with production broker`);
              this.productionBroker.setupMessageHandler((topic, message, packet) => this.productionBrokerMessageHandler(topic, message, packet));
              // Add the sensors which have the data source from the production broker
              this.sensorsConfig.map(sensorData => {
                const {
                  id,
                  scale,
                  enable,
                  objectId,
                  dataSource
                } = sensorData;
                if (enable && dataSource === DS_RECORDER) {
                  console.log('Going to add a RECORDER sensor');
                  let nbSensors = scale ? scale : 1;
                  if (nbSensors === 1) {
                    this.addSensor(id, sensorData, objectId);
                  } else {
                    for (let sensorIndex = 0; sensorIndex < nbSensors; sensorIndex++) {
                      const sID = `${id}-${sensorIndex}`;
                      this.addSensor(sID, sensorData, objectId);
                    }
                  }
                };

              });
            }
          });
        } else {
          console.log(`[${this.id}] NO RECORDING DATA`);
        }

        if (this.dataStorageConfig) {
          this.dataStorage = new DataStorage(this.dataStorageConfig);
          this.dataStorage.connect((err3) => {
            if (err3) {
              console.error('Failed to connect to data storage', err3);
            } else {
              console.log(`[${this.id}] Connected to data storage`);
              if (this.report && this.isFirstDevice) {
                // Add the report
                console.log(`[${this.id}] Going to add a new report`);
                console.log(this.report);
                this.dataStorage.saveReport(this.report);
              }
              if (this.report && this.isFirstDevice) {
                // Add the dataset for the current test
                console.log(`[${this.id}] Going to add a new dataset`);
                console.log(this.newDatasetConfig);
                this.dataStorage.saveDataset(this.newDatasetConfig);
              }
              // Add sensors which have data source from data storage
              this.sensorsConfig.map(sensorData => {
                const {
                  id,
                  scale,
                  enable,
                  objectId,
                  dataSource
                } = sensorData;
                if (enable && dataSource === DS_DATASET) {
                  console.log('Going to add a DATASET sensor');
                  let nbSensors = scale ? scale : 1;
                  if (nbSensors === 1) {
                    this.addSensor(id, sensorData, objectId);
                  } else {
                    for (let sensorIndex = 0; sensorIndex < nbSensors; sensorIndex++) {
                      const sID = `${id}-${sensorIndex}`;
                      this.addSensor(sID, sensorData, objectId);
                    }
                  }
                };
              });
            }
          });
        } else {
          console.log(`[${this.id}] NO DATA STORAGE`);
        }
        this.status = ONLINE;
        // Add sensors
        for (let sensorIndex = 0; sensorIndex < this.sensorsConfig.length; sensorIndex++) {
          const sensorData = this.sensorsConfig[sensorIndex];
          const {
            id,
            scale,
            enable,
            objectId,
            dataSource
          } = sensorData;
          if (enable === false || dataSource !== DS_DATA_GENERATOR) continue;
          let nbSensors = scale ? scale : 1;
          if (nbSensors === 1) {
            this.addSensor(id, sensorData, objectId);
          } else {
            for (let sensorIndex = 0; sensorIndex < nbSensors; sensorIndex++) {
              const sID = `${id}-${sensorIndex}`;
              this.addSensor(sID, sensorData, objectId);
            }
          }
        }
        // Add actuators
        for (let aIndex = 0; aIndex < this.actuators.length; aIndex++) {
          const actuatorData = this.actuators[aIndex];
          const {
            id,
            scale,
            enable,
            objectId
          } = actuatorData;
          if (enable === false) continue;
          let nbActuators = scale ? scale : 1;
          if (nbActuators === 1) {
            this.addActuator(id, actuatorData, objectId);
          } else {
            for (
              let actuatorIndex = 0; actuatorIndex < nbActuators; actuatorIndex++
            ) {
              const actID = `${id}-${actuatorIndex}`;
              this.addActuator(actID, actuatorData, objectId);
            }
          }
        }
        return callback();
      });
    }
  }

  /**
   * Start the simulation of this Device
   * - Start all the sensors
   * - Start all the actuators
   */
  start() {
    switch (this.getStatus()) {
      case ONLINE:
        this.startedTime = Date.now();
        // Check for the gateway behaviour
        this.sensors.map((sensor) => sensor.start());
        this.setStatus(SIMULATING);
        if (this.behaviours.indexOf('GATEWAY_DOWN') > -1 && this.timeToFailed > 0) {
          setTimeout(() => {
            this.stop();
          }, this.timeToFailed * 1000);
        }
        this.actuators.map((actuator) => actuator.start());
        break;
      case OFFLINE:
        console.error(`[${this.id}] must be online before starting simulation: ${this.getStatus()}`);
        break;
      case SIMULATING:
        console.log(`[${this.id}] is simulating!`);
        break;
      default:
        break;
    }
  }

  /**
   * Stop the simulation of this Device
   * - stop all the sensors
   * - stop all the actuators
   */
  stop() {
    switch (this.getStatus()) {
      case OFFLINE:
        console.error(`[${this.id}] ERROR: offline!`);
        break;
      case ONLINE:
        this.setStatus(OFFLINE);
        break;
      case SIMULATING:
        console.log(`[${this.id}] going to stop the simulation!`);
        this.sensors.map((sensor) => sensor.stop());
        this.actuators.map((actuator) => actuator.stop());
        this.setStatus(OFFLINE);
        break;
      default:
        break;
    }
  }
}

module.exports = Device;