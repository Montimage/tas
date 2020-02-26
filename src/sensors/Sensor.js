const { SIMULATING, OFFLINE } = require('../constants');
const DataGenerator = require('../data-generators/DataGenerator');
const { ENACTDB, SensorSchema } = require("../enact-mongoose");
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
  constructor(id, dataSource, publishDataFct) {
    this.id = id;
    this.dataSource = dataSource;
    this.status = OFFLINE;
    this.dbClient = null;
    this.publishDataFct = publishDataFct;
  }

  /**
   * Publish list of sensor's data
   * @param {Array} listData List of sensor's data to be published
   */
  publishDataWithTimestamp(listData) {
    this.status = SIMULATING;
    const startTime = listData[0].timestamp;
    for (let index = 0; index < listData.length; index++) {
      if (this.status === SIMULATING) {
        setTimeout(() => {
          if (this.status === SIMULATING) {
            const dataToBePublished = JSON.parse(listData[index].value);
            console.log(`[${this.id}] `, dataToBePublished);
            this.publishDataFct(dataToBePublished);
            if (index === listData.length - 1) {
              console.log(`[${this.id}] Finished!`);
              this.status = OFFLINE;
            }
          }
        }, listData[index].timestamp - startTime);
      }
    }
  }

  /**
   * Generate randomly sensor' data
   */
  generateRandomData() {
    const { dataDescription, timeInterval } = this.dataSource;
    console.log(
      `[${this.id}] generate randomly data ${dataDescription.type} and publish the data in every ${timeInterval} seconds`
    );
    const dataGenerator = new DataGenerator(dataDescription, timeInterval);
    const timerID = setInterval(() => {
      if (this.status === SIMULATING) {
        dataGenerator.generateData(data => {
          this.publishDataFct(data);
        });
      } else {
        clearInterval(timerID);
      }
    }, timeInterval * 1000);
  }

  /**
   * Read data from a database and publish the data based on the timestamp, sensor id
   *
   */
  readDataFromDatabase() {
    const { startTime, dbConfig } = this.dataSource;
    const endTime = this.dataSource.endTime
      ? this.dataSource.endTime
      : Date.now();
    console.log(
      `[${this.id}] read data from database ${dbConfig.HOST}:${dbConfig.PORT}/${dbConfig.DBNAME}`
    );
    console.log(`StartTime: ${startTime}, endTime: ${endTime}`);
    if (dbConfig.USER && dbConfig.PASSWORD) {
      this.dbClient = new ENACTDB(dbConfig.HOST, dbConfig.PORT, dbConfig.DBNAME, {
        userName: dbConfig.USER,
        password: dbConfig.PASSWORD
      });
    } else {
      this.dbClient = new ENACTDB(dbConfig.HOST, dbConfig.PORT, dbConfig.DBNAME);
    }
    this.dbClient.connect(() => {
      console.log("[${this.id}] connected to database");
      SensorSchema.findSensorDataBetweenTimes(
        { sensorID: this.id },
        startTime,
        endTime,
        (err, listData) => {
          if (err) {
            console.error(
              `[${this.id}] ERROR: cannot find any data`,
              err
            );
            this.status = OFFLINE;
          } else {
            console.log("Number of data: ", listData.length);
            this.dbClient.close();
            if (listData.length > 0) {
              this.publishDataWithTimestamp(listData);
            } else {
              console.error(
                `[${this.id}] ERROR: cannot find any data`,
                err
              );
              this.status = OFFLINE;
            }
          }
        }
      );
    });
  }

  /**
   * Start simulating a sensor
   * @param {Object} mqttClient The mqtt client to publish data
   */
  start() {
    if (this.status === OFFLINE) {
      console.log(`[${this.id}] publishes data on channel: ${this.topic}`);
      if (this.dataSource.source === "random") {
        this.status = SIMULATING;
        this.generateRandomData();
      } else if (this.dataSource.source === "database") {
        this.status = SIMULATING;
        this.readDataFromDatabase();
      } else {
        console.error(
          `[${this.id}] ERROR: does not support data source: ${this.dataSource.source}`
        );
      }
    } else {
      console.log(`[${this.id}] is simulating!`);
    }
  }

  /**
   * Stop simulating the sensor
   */
  stop() {
    if (this.status === OFFLINE) {
      console.log(`[${this.id}] is offline!`);
    } else {
      this.status = OFFLINE;
      if (this.dbClient) {
        this.dbClient.close();
      }
      console.log(`[${this.id}] stopped!`);
    }
  }
}

module.exports = Sensor;