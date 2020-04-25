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
  constructor(id, data, publishDataFct) {
    const {
      objectId,
      name,
      isFromDatabase,
      options,
      userData,
      dataSource,
    } = data;
    this.id = id;
    this.isFromDatabase = isFromDatabase;
    this.dataSourceConfig = dataSource;
    // Optional attributes
    this.name = name ? name : `sensor-${id}`;
    this.objectId = objectId;
    options["ipsoTopic"] = objectId ? `${objectId}/${id}` : id;
    this.options = options;
    this.dataSource = null;
    this.publishDataFct = publishDataFct;
    this.userData = userData;
  }

  dataHandler(values) {
    values["timestamp"] = Date.now();
    values["instanceId"] = this.id;
    if (this.userData) {
      values["userData"] = this.userData;
    }
    if (this.name) {
      values["name"] = this.name;
    }
    if (this.objectId) {
      values["objectId"] = this.objectId;
    }
    this.publishDataFct(values, this.id, this.options);
  }

  /**
   * Start simulating a sensor
   */
  start() {
    if (!this.dataSource) {
      if (this.isFromDatabase) {
        this.dataSource = new DataReplayer(
          this.id,
          (values) => this.dataHandler(values),
          this.dataSourceConfig,
          this.options.devType ? this.options.devType : 'SENSOR'
        );
      } else {
        this.dataSource = new DataGenerator(
          this.id,
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
          this.id
        }] has been started at: ${new Date(startedTime).toLocaleTimeString()}`
      );
      this.dataSource.start();
    } else {
      console.log(
        `[${this.id}${
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

module.exports = Sensor;
