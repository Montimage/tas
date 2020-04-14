const { SIMULATING, OFFLINE } = require("../DeviceStatus");
const ds = require("../DataSourceType");
const abnormalBehaviours = require("../AbnormalBehaviours");
const DataSource = require("./data-sources/DataSource");
const { ENACTDB, SensorSchema, ActuatorSchema } = require("../enact-mongoose");
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
      name,
      isFromDatabase,
      timePeriod,
      sources,
      dosAttackSpeedUpRate,
      timeBeforeFailed,
      dbClient,
      sensorBehaviours,
      energy,
      metaData,
      options,
      dbConfig,
    } = data;
    this.id = id;
    this.isFromDatabase = isFromDatabase;
    this.dbConfig = dbConfig;
    this.name = name;
    this.status = OFFLINE;
    this.timePeriod = timePeriod;
    this.originalTimePeriod = timePeriod;
    this.publishDataFct = publishDataFct;
    this.dosAttackSpeedUpRate = dosAttackSpeedUpRate ? dosAttackSpeedUpRate : 0;
    this.timeBeforeFailed = timeBeforeFailed ? timeBeforeFailed : 0;
    this.dbClient = dbClient;
    this.sensorBehaviours = sensorBehaviours ? sensorBehaviours : [];
    this.options = options;
    // Validate the input data
    if (isFromDatabase && !dbClient) {
      console.error(
        `[${this.id}] Cannot initialize this sensor! dbClient is NULL`
      );
      return null;
    }
    if (sensorBehaviours.length > 0) {
      if (
        sensorBehaviours.indexOf(abnormalBehaviours.AB_NODE_FAILED) > -1 &&
        timeBeforeFailed === 0
      ) {
        console.error(
          `[${this.id}] Cannot initialize this sensor! timeBeforeFailed is 0`
        );
        return null;
      }

      if (
        sensorBehaviours.indexOf(abnormalBehaviours.AB_DOS_ATTACK) > -1 &&
        dosAttackSpeedUpRate === 0
      ) {
        console.error(
          `[${this.id}] Cannot initialize this sensor! dosAttackSpeedUpRate is 0`
        );
        return null;
      }
    }

    this.value = { metaData };
    if (energy) {
      if (energy.type !== ds.DS_ENERGY) {
        console.warn(
          `[${this.id}] Energy data source is invalid: ${energy.type}`
        );
      }
      const energySource = new DataSource(energy.key, ds.DS_ENERGY, energy);
      this.value[energySource.key] = energySource.getValue();
      this.energy = energySource;
    }
    this.sources = [];
    if (sources && sources.length > 0) {
      sources.map((s) => {
        const newSource = new DataSource(s.key, s.type, s);
        this.value[newSource.key] = newSource.getValue();
        this.sources.push(newSource);
      });
    }

    this.startedTime = 0;
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
            // const dataToBePublished = JSON.parse(listData[index].value);
            // console.log(`[${this.id}] `, dataToBePublished);
            const { timestamp, value } = listData[index];
            this.publishDataFct(
              { id: this.id, name: this.name, timestamp, value },
              this.id
            );
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
    const timerID = setInterval(() => {
      // Check the status
      if (this.status !== SIMULATING) {
        clearInterval(timerID);
        return;
      }

      // Check the time based behaviour: NODE_FAILED
      const currentTime = Date.now();
      if (this.sensorBehaviours.length > 0) {
        if (
          this.sensorBehaviours.indexOf(abnormalBehaviours.AB_NODE_FAILED) > -1
        ) {
          if (currentTime - this.startedTime >= this.timeBeforeFailed * 1000) {
            console.log(`[${this.id}] Going to FAIL!`);
            this.stop();
          }
        }

        // Check the time based behaviour: SLOW_DOS_ATTACK
        if (
          this.sensorBehaviours.indexOf(abnormalBehaviours.AB_SLOW_DOS_ATTACK) >
          -1
        ) {
          if (this.timePeriod === this.originalTimePeriod) {
            this.timePeriod += 1; // Increase 1 second
            console.log(
              `[${this.id}] Injecting SLOW_DOS_ATTACK with new time period: ${this.timePeriod} (original: ${this.originalTimePeriod})`
            );
            clearInterval(timerID);
            return this.generateRandomData();
          }
        }

        // Check the time based behaviour: DOS_ATTACK
        if (
          this.sensorBehaviours.indexOf(abnormalBehaviours.AB_DOS_ATTACK) > -1
        ) {
          if (this.timePeriod === this.originalTimePeriod) {
            this.timePeriod = this.timePeriod / this.dosAttackSpeedUpRate; // Increase 1 second
            console.log(
              `[${this.id}] Injecting DOS_ATTACK with new time period: ${this.timePeriod} (original: ${this.originalTimePeriod})`
            );
            clearInterval(timerID);
            return this.generateRandomData();
          }
        }

        if (this.energy) {
          // Check the energy behaviour: OUT_OF_ENERGY
          if (
            this.sensorBehaviours.indexOf(abnormalBehaviours.AB_OUT_OF_ENERGY) >
            -1
          ) {
            if (this.energy.value <= 0) {
              console.log(`[${this.id}] Out of energy. Going to STOP!`);
              this.stop();
            }
          }
          // Check the energy behaviour: LOW_ENERGY
          const low_energy_index = this.sensorBehaviours.indexOf(
            abnormalBehaviours.AB_LOW_ENERGY
          );
          if (low_energy_index > -1) {
            if (this.energy.value <= this.energy.dataGenerator.low) {
              console.log(
                `[${this.id}] Low energy. Going to change the frequency!`
              );
              this.timePeriod =
                this.timePeriod * this.energy.dataGenerator.slowDownWeight;
              this.sensorBehaviours.splice(low_energy_index, 1);
              clearInterval(timerID);
              return this.generateRandomData();
            }
          }
        }
      }
      if (this.energy) {
        this.energy.readData();
        // Update energy data field
        this.value[this.energy.key] = this.energy.getValue();
      }
      // get other data
      for (let index = 0; index < this.sources.length; index++) {
        const source = this.sources[index];
        source.readData();
        this.value[source.key] = source.getValue();
      }
      const timestamp = Date.now();
      // console.log("Timer: ", new Date(timestamp).toLocaleTimeString());
      // SEND DATA
      this.publishDataFct(
        { timestamp, id: this.id, name: this.name, value: this.value },
        this.id,
        this.options
      );
    }, this.timePeriod * 1000);
  }

  /**
   * Read data from a database and publish the data based on the timestamp, sensor id
   *
   */
  readDataFromDatabase() {
    const {
      host,
      port,
      user,
      password,
      dbname,
      devID,
      startTime,
    } = this.dbConfig;

    const endTime = this.dbConfig.endTime ? this.dbConfig.endTime : Date.now();
    console.log(
      `[${this.id}] read data from database ${host}:${port}/${dbname}`
    );
    console.log(`StartTime: ${startTime}, endTime: ${endTime}`);
    if (user && password) {
      this.dbClient = new ENACTDB(host, port, dbname, {
        userName: user,
        password: password,
      });
    } else {
      this.dbClient = new ENACTDB(host, port, dbname);
    }
    this.dbClient.connect(() => {
      console.log(`[${this.id}] connected to database`);
      const { devType } = this.options;
      if (devType === "SENSOR") {
        SensorSchema.findSensorDataBetweenTimes(
          { id: devID },
          startTime,
          endTime,
          (err, listData) => {
            if (err) {
              console.error(`[${this.id}] ERROR: cannot find any data`, err);
              this.status = OFFLINE;
            } else {
              console.log(`[${this.id}] Number of data: ${listData.length}`);
              this.dbClient.close();
              if (listData.length > 0) {
                this.publishDataWithTimestamp(listData);
              } else {
                console.error(`[${this.id}] ERROR: cannot find any data`, err);
                this.status = OFFLINE;
              }
            }
          }
        );
      } else if (devType === "ACTUATOR") {
        ActuatorSchema.findActuatorDataBetweenTimes(
          { id: devID },
          startTime,
          endTime,
          (err, listData) => {
            if (err) {
              console.error(`[${this.id}] ERROR: cannot find any data`, err);
              this.status = OFFLINE;
            } else {
              console.log(`[${this.id}] Number of data: ${listData.length}`);
              this.dbClient.close();
              if (listData.length > 0) {
                this.publishDataWithTimestamp(listData);
              } else {
                console.error(`[${this.id}] ERROR: cannot find any data`, err);
                this.status = OFFLINE;
              }
            }
          }
        );
      } else {
        console.error(`[${this.id}] ERROR: Unsupported device ${devType}`);
        this.status = OFFLINE;
      }
    });
  }

  /**
   * Start simulating a sensor
   * @param {Object} mqttClient The mqtt client to publish data
   */
  start() {
    if (this.status !== SIMULATING) {
      this.startedTime = Date.now();
      console.log(
        `[${this.id}] has been started at: ${new Date(
          this.startedTime
        ).toLocaleTimeString()}`
      );
      if (this.isFromDatabase) {
        this.readDataFromDatabase();
      } else {
        this.generateRandomData();
      }
      this.status = SIMULATING;
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
      console.log(
        `[${this.id}] stopped at: ${new Date().toLocaleTimeString()}`
      );
    }
  }
}

module.exports = Sensor;
