const { OFFLINE } = require('../DeviceStatus');
const { ENACTDB, ActuatorSchema } = require("../enact-mongoose");

const Sensor = require('../sensors');

/**
 * ActuatedData extends from Sensor class,
 */
class ActuatedData extends Sensor {
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
      `[${this.id}] read data from database ${dbConfig.host}:${dbConfig.port}/${dbConfig.dbname}`
    );
    console.log(`[${this.id}] StartTime: ${startTime}, endTime: ${endTime}`);
    if (dbConfig.user && dbConfig.password) {
      this.dbClient = new ENACTDB(dbConfig.host, dbConfig.port, dbConfig.dbname, {
        userName: dbConfig.user,
        password: dbConfig.password
      });
    } else {
      this.dbClient = new ENACTDB(dbConfig.host, dbConfig.port, dbConfig.dbname);
    }
    this.dbClient.connect(() => {
      console.log(`[${this.id}] connected to database`);
      ActuatorSchema.findActuatorDataBetweenTimes(
        { actID: this.id },
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
            // console.log("Number of data: ", listData.length);
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
}

module.exports = ActuatedData;