const {
  SIMULATING,
  OFFLINE
} = require("../DeviceStatus");
const {
  DS_DATASET,
  DS_RECORDER
} = require('../DataSourceType');
const DataReplayer = require("./DataReplayer");
const DataGenerator = require("./DataGenerator");
/**
 * The Sensor class presents a sensor
 * - Collect the data: randomly or from database
 * - Publish the data
 */
class Sensor {
  /**
   *
   * @param {String} id The sensor's id
   * @param {String} topic The mqtt topic to publish the data
   * @param {Object} dataSource The data source of the sensor
   * -
   */
  constructor(id, data, productionBroker, publishDataFct, events, startReplayingTime, callbackWhenFinish = null) {
    const {
      objectId,
      name,
      topic,
      dataSpecs,
      dataSource,
      reportFormat,
      replayOptions
    } = data;
    this.id = id;
    this.reportFormat = reportFormat ? reportFormat: 0;
    this.productionBroker = productionBroker;
    this.publishDataFct = publishDataFct;
    this.dataSourceType = dataSource;
    this.dataSource = null;
    this.dataSpecs = dataSpecs;
    this.replayOptions = replayOptions;
    this.events = events;
    this.callbackWhenFinish = callbackWhenFinish;
    // Optional attributes
    this.name = name ? name : `sensor-${id}`;
    this.objectId = objectId;
    this.topic = topic;
    this.topicEnd = null;
    if (objectId) {
      this.topicEnd = `${objectId}/${id}`;
    } else {
      this.topicEnd = id;
    }
    this.status = OFFLINE;
    // Statstics
    this.lastActivity = Date.now();
    this.startedTime = 0;
    this.numberOfSentData = 0;
    this.lastSentData = null;
    this.startReplayingTime = startReplayingTime;
  }

  updateStartReplayingTime(time) {
    this.startReplayingTime = time;
  }

  getStats() {
    return {
      id: this.id,
      status: this.dataSource ? this.dataSource.getStatus() : null,
      numberOfSentData: this.numberOfSentData,
      startedTime: this.startedTime,
      lastActivity: this.lastActivity,
      lastSentData: this.lastSentData,
      isFromDatabase: this.isFromDatabase,
      dataSource: this.dataSource ? this.dataSource.getStats() : null,
      topic: this.topic
    };
  }

  dataHandler(values, topic = null) {
    if (typeof values === 'object') {
      values["timestamp"] = Date.now();
      values["instanceId"] = this.id;
      if (this.name) {
        values["name"] = this.name;
      }
      if (this.objectId) {
        values["objectId"] = this.objectId;
      }
    }
    console.log(`[${this.id}] published data on topic: ${topic ? topic: this.topic}`);
    this.publishDataFct(topic ? topic : this.topic, values);
    // Statistics
    this.lastActivity = Date.now();
    this.lastSentData = values;
    this.numberOfSentData++;
    // console.log(this.getStats());
  }

  /**
   * Start simulating a sensor
   */
  start() {
    if (this.status === SIMULATING) {
      console.log(`[${this.id}] has already started!`);
      return;
    }
    if (this.dataSourceType === DS_RECORDER) {
      this.productionBroker.subscribe(this.topic);
      this.status = SIMULATING;
    } else {
      if (!this.dataSource) {
        // Init
        const stopSensor = () => this.stop();
        if (this.dataSourceType === DS_DATASET) {
          console.log(`[${this.id}] Number of events to be replayed: ${this.events.length} with replayOptions: ${JSON.stringify(this.replayOptions)}`);
          if (this.events.length === 0) {
            console.log(`[${this.id}] Going to stop -> no data to replay`);
            this.stop();
          } else {
            this.dataSource = new DataReplayer(
              this.id,
              (values, topic = null) => this.dataHandler(values, topic),
              () => {
                stopSensor();
              },
              this.replayOptions,
              this.events,
              this.objectId,
              this.startReplayingTime
            );
          }
        } else {
          this.dataSource = new DataGenerator(
            this.id,
            (values, topic = null) => this.dataHandler(values, topic),
            () => {
              stopSensor();
            },
            this.dataSpecs,
            this.objectId,
            this.reportFormat
          );
        }
      }
      if (this.dataSource && this.dataSource.getStatus() !== SIMULATING) {
        this.startedTime = Date.now();
        console.log(
          `[${this.objectId ? this.objectId : "sensor"}-${
            this.id
          }] has been started at: ${new Date(this.startedTime).toLocaleTimeString()}`
        );
        this.dataSource.start();
        this.status = SIMULATING;
      } else {
        console.log(
          `[${this.id}${
            this.objectId ? this.objectId : "sensor-"
          }] is simulating!`
        );
      }
    }
  }

  /**
   * Stop simulating the sensor
   */
  stop() {
    if (this.status === OFFLINE) {
      console.log(`[${this.id}] is already offline!`);
      return;
    }
    if (this.dataSourceType === DS_RECORDER) {
      this.productionBroker.unsubscribe(this.topic);
      this.status = OFFLINE;
    } else {
      if (this.dataSource) {
        if (this.dataSource.getStatus() === OFFLINE) {
          console.log(
            `[${this.objectId ? this.objectId : "sensor"}-${
              this.id
            }] is offline!`
          );
        } else {
          this.dataSource.stop();
          console.log(
            `[${this.objectId ? this.objectId : "sensor"}-${
                this.id
              }] stopped at: ${new Date().toLocaleTimeString()}`
          );
        }
      }
    }
    this.status = OFFLINE;
    if (this.callbackWhenFinish) this.callbackWhenFinish();
  }
}

module.exports = Sensor;
