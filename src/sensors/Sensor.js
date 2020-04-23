const { SIMULATING, OFFLINE } = require("../DeviceStatus");
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
  constructor(instanceId, data, publishDataFct) {
    const {
      objectId,
      name,
      isFromDatabase,
      options,
      userData,
      dataSource,
    } = data;
    this.instanceId = instanceId;
    this.isFromDatabase = isFromDatabase;
    this.dataSourceConfig = dataSource;
    // Optional attributes
    this.name = name ? name : `sensor-${instanceId}`;
    this.objectId = objectId;
    options["ipsoTopic"] = objectId ? `${objectId}/${instanceId}` : instanceId;
    this.options = options;
    this.dataSource = null;
    this.publishDataFct = publishDataFct;
    this.userData = userData;
  }

  dataHandler(values) {
    values["timestamp"] = Date.now();
    values["instanceId"] = this.instanceId;
    if (this.userData) {
      values["userData"] = this.userData;
    }
    if (this.name) {
      values["name"] = this.name;
    }
    if (this.objectId) {
      values["objectId"] = this.objectId;
    }
    this.publishDataFct(values, this.instanceId, this.options);
  }

  /**
   * Start simulating a sensor
   */
  start() {
    if (!this.dataSource) {
      if (this.isFromDatabase) {
        this.dataSource = new DataReplayer(
          this.instanceId,
          (values) => this.dataHandler(values),
          this.dataSourceConfig,
          this.options.devType ? this.options.devType : 'SENSOR'
        );
      } else {
        this.dataSource = new DataGenerator(
          this.instanceId,
          (values) => this.dataHandler(values),
          this.dataSourceConfig,
          this.objectId
        );
      }
    }
    if (this.dataSource.getStatus() !== SIMULATING) {
      const startedTime = Date.now();
      console.log(
        `[${this.objectId ? this.objectId : "sensor"}-${
          this.instanceId
        }] has been started at: ${new Date(startedTime).toLocaleTimeString()}`
      );
      this.dataSource.start();
    } else {
      console.log(
        `[${this.instanceId}${
          this.objectId ? this.objectId : "sensor-"
        }] is simulating!`
      );
    }
  }

  /**
   * Stop simulating the sensor
   */
  stop() {
    if (this.dataSource.getStatus() === OFFLINE) {
      console.log(
        `[${this.objectId ? this.objectId : "sensor"}-${
          this.instanceId
        }] is offline!`
      );
    } else {
      this.dataSource.stop();
      console.log(
        `[${this.objectId ? this.objectId : "sensor"}-${
          this.instanceId
        }] stopped at: ${new Date().toLocaleTimeString()}`
      );
    }
  }
}

module.exports = Sensor;
