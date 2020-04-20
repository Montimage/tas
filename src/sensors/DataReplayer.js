const { SIMULATING, OFFLINE } = require("../DeviceStatus");
const { ENACTDB, SensorSchema, ActuatorSchema } = require("../enact-mongoose");
const DeviceDataSource = require('./DeviceDataSource');

class DataReplayer extends DeviceDataSource{
  constructor(parentID, userData, options, publishDataFct, dataResource) {
    super(parentID, userData, options, publishDataFct);
    const { connConfig, devID, startTime, endTime } = dataResource;
    this.connConfig = connConfig;
    this.devID = devID;
    this.startTime = startTime;
    this.endTime = endTime ? endTime : Date.now();
    this.dbClient = null;
  }

  /**
   * Publish list of sensor's data
   * @param {Array} listData List of sensor's data to be published
   */
  publishDataWithTimestamp(listData) {
    const startTime = listData[0].timestamp;
    for (let index = 0; index < listData.length; index++) {
      if (this.status === SIMULATING) {
        setTimeout(() => {
          if (this.status === SIMULATING) {
            // const dataToBePublished = JSON.parse(listData[index].value);
            // console.log(`[${this.parentID}] `, dataToBePublished);
            const { timestamp, value } = listData[index];
            if (this.userData) {
              value["userData"] = this.userData;
            }
            this.publishDataFct(
              { id: this.parentID, name: this.name, timestamp, value },
              this.parentID
            );
            if (index === listData.length - 1) {
              console.log(`[${this.parentID}] Finished!`);
              this.status = OFFLINE;
            }
          }
        }, listData[index].timestamp - startTime);
      }
    }
  }

  start() {
    super.start();
    const { host, port, user, password, dbname } = this.connConfig;
    console.log(
      `[${this.parentID}] read data from database ${host}:${port}/${dbname}`
    );
    console.log(`StartTime: ${this.startTime}, endTime: ${this.endTime}`);
    if (user && password) {
      this.dbClient = new ENACTDB(host, port, dbname, {
        userName: user,
        password: password,
      });
    } else {
      this.dbClient = new ENACTDB(host, port, dbname);
    }
    this.dbClient.connect(() => {
      console.log(`[${this.parentID}] connected to database`);
      if (this.options.devType === "SENSOR") {
        SensorSchema.findSensorDataBetweenTimes(
          { id: this.devID },
          this.startTime,
          this.endTime,
          (err, listData) => {
            if (err) {
              console.error(
                `[${this.parentID}] ERROR: cannot find any data`,
                err
              );
              this.status = OFFLINE;
            } else {
              console.log(
                `[${this.parentID}] Number of data: ${listData.length}`
              );
              this.dbClient.close();
              if (listData.length > 0) {
                this.publishDataWithTimestamp(listData);
              } else {
                console.error(
                  `[${this.parentID}] ERROR: cannot find any data`,
                  err
                );
                this.status = OFFLINE;
              }
            }
          }
        );
      } else if (this.options.devType === "ACTUATOR") {
        ActuatorSchema.findActuatorDataBetweenTimes(
          { id: this.devID },
          this.startTime,
          this.endTime,
          (err, listData) => {
            if (err) {
              console.error(
                `[${this.parentID}] ERROR: cannot find any data`,
                err
              );
              this.status = OFFLINE;
            } else {
              console.log(
                `[${this.parentID}] Number of data: ${listData.length}`
              );
              this.dbClient.close();
              if (listData.length > 0) {
                this.publishDataWithTimestamp(listData);
              } else {
                console.error(
                  `[${this.parentID}] ERROR: cannot find any data`,
                  err
                );
                this.status = OFFLINE;
              }
            }
          }
        );
      } else {
        console.error(
          `[${this.parentID}] ERROR: Unsupported device ${this.devType}`
        );
        this.status = OFFLINE;
      }
    });
  }

  stop() {
    if (this.dbClient) {
      this.dbClient.close();
    }
    super.stop();
  }
}

module.exports = DataReplayer;
