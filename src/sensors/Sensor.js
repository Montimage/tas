const { SIMULATING, OFFLINE } = require("../DeviceStatus");
const DataReplayer = require('./DataReplayer');
const DataGenerator = require('./DataGenerator');
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
    const { name, isFromDatabase, options, userData, dataSource } = data;
    this.id = id;
    this.name = name;
    this.options = options;
    if (isFromDatabase) {
      this.dataSource = new DataReplayer(
        id,
        userData,
        options,
        publishDataFct,
        dataSource
      );
    } else {
      this.dataSource = new DataGenerator(id, userData, options, publishDataFct, dataSource);
    }
  }

  /**
   * Start simulating a sensor
   */
  start() {
    if (this.dataSource.getStatus() !== SIMULATING) {
      const startedTime = Date.now();
      console.log(
        `[${this.id}] has been started at: ${new Date(
          startedTime
        ).toLocaleTimeString()}`
      );
      this.dataSource.start();
    } else {
      console.log(`[${this.id}] is simulating!`);
    }
  }

  /**
   * Stop simulating the sensor
   */
  stop() {
    if (this.dataSource.getStatus() === OFFLINE) {
      console.log(`[${this.id}] is offline!`);
    } else {
      this.dataSource.stop();
      console.log(
        `[${this.id}] stopped at: ${new Date().toLocaleTimeString()}`
      );
    }
  }
}

module.exports = Sensor;
