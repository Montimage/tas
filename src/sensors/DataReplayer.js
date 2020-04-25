const { SIMULATING, OFFLINE } = require("../DeviceStatus");
const { ENACTDB, SensorSchema, ActuatorSchema } = require("../enact-mongoose");
const DeviceDataSource = require('./DeviceDataSource');

class DataReplayer extends DeviceDataSource{
  constructor(id, dataHandler, dataResource, devType, objectId) {
    super(id, dataHandler);
    const { connConfig, devId, startTime, endTime } = dataResource;
    this.connConfig = connConfig;
    this.objectId = objectId;
    this.devId = devId;
    this.startTime = startTime;
    this.endTime = endTime ? endTime : Date.now();
    this.devType = devType;
  }

  /**
   * Publish list of sensor's data
   * @param {Array} listData List of sensor's data to be published
   */
  handleDataList(listData) {
    const startTime = listData[0].timestamp;
    for (let index = 0; index < listData.length; index++) {
      if (this.status === SIMULATING) {
        setTimeout(() => {
          if (this.status === SIMULATING) {
            const {instanceId, objectId, values, timestamp, name } = listData[index];
            this.dataHandler({instanceId, objectId, values, timestamp, name });
            if (index === listData.length - 1) {
              console.log(`[${this.id}] Finished!`);
              this.status = OFFLINE;
            }
          }
        }, listData[index].timestamp - startTime);
      }
    }
  }

  start() {
    super.start();
    let dbClient = null;
    const { host, port, user, password, dbname } = this.connConfig;
    console.log(
      `[${this.id}] read data from database ${host}:${port}/${dbname}`
    );
    console.log(`StartTime: ${this.startTime}, endTime: ${this.endTime}`);
    if (user && password) {
      dbClient = new ENACTDB(host, port, dbname, {
        userName: user,
        password: password,
      });
    } else {
      dbClient = new ENACTDB(host, port, dbname);
    }
    dbClient.connect(() => {
      console.log(`[${this.id}] connected to database`);
      const filter = { instanceId: this.devId };
        if (this.objectId) {
          filter['objectId'] = this.objectId;
        }
      if (this.devType === "SENSOR") {

        SensorSchema.findSensorDataBetweenTimes(
          filter,
          this.startTime,
          this.endTime,
          (err, listData) => {
            if (err) {
              console.error(
                `[${this.id}] ERROR: cannot find any data ${this.devId}`,
                err
              );
              this.status = OFFLINE;
            } else {
              console.log(
                `[${this.id}] Number of data: ${listData.length}`
              );
              dbClient.close();
              if (listData.length > 0) {
                this.handleDataList(listData);
              } else {
                console.error(
                  `[${this.id}] ERROR: cannot find any data ${this.devId}`,
                  err
                );
                this.status = OFFLINE;
              }
            }
          }
        );
      } else if (this.devType === "ACTUATOR") {
        ActuatorSchema.findActuatorDataBetweenTimes(
          filter,
          this.startTime,
          this.endTime,
          (err, listData) => {
            if (err) {
              console.error(
                `[${this.id}] ERROR: cannot find any data ${this.devId}`,
                err
              );
              this.status = OFFLINE;
            } else {
              console.log(
                `[${this.id}] Number of data: ${listData.length}`
              );
              dbClient.close();
              if (listData.length > 0) {
                this.handleDataList(listData);
              } else {
                console.error(
                  `[${this.id}] ERROR: cannot find any data ${this.devId}`,
                  err
                );
                this.status = OFFLINE;
              }
            }
          }
        );
      } else {
        console.error(
          `[${this.id}] ERROR: Unsupported device ${this.devType}`
        );
        this.status = OFFLINE;
      }
    });
  }
}

module.exports = DataReplayer;
