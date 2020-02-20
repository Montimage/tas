const { OFFLINE } = require('../constants');
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
      `Read data from database ${dbConfig.HOST}:${dbConfig.PORT}/${dbConfig.DBNAME}`
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
      console.log("Connected to database");
      ActuatorSchema.findActuatorDataBetweenTimes(
        { actID: this.id },
        startTime,
        endTime,
        (err, listData) => {
          if (err) {
            console.error(
              `[ERROR] Cannot find any data for actuator ${this.id}`,
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
                `[ERROR] Cannot find any data for actuator ${this.id}`,
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