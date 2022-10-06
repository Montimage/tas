const { DATABASE, ActuatorSchema, SensorSchema } = require("../mongoose");
const Thing = require("./Thing");
const { ONLINE, OFFLINE, SIMULATING } = require("../DeviceStatus");
/**
 * The Thing class presents a THING component:
 * - List of sensors
 * - List of actuators
 * - Possibility to communicate with a gateway
 *  + send data - to multiple channels: `things/thing-id/sensors/sensor-id`
 *  + receive data - listen to multiple channels: `things/thing-id/actuators/#`
 */
class DataGenerator extends Thing {
  constructor(id) {
    super(id);
    this.db = null;
    this.dbConfig = null;
  }

  /**
   * Override the @Thing.initThing() function to initialise the MQTT client
   * @param {Function} callback The callback function
   */
  initThing(callback, dbConfig) {
    this.dbConfig = dbConfig;
    if (!dbConfig) {
      console.error(
        `[Data-Generator] ERROR: Missing database configuration:`,
        dataConfig
      );
      return;
    }

    if (dbConfig.username && dbConfig.password) {
      this.db = new DATABASE(
        dbConfig.host,
        dbConfig.port,
        dbConfig.dbname,
        {
          username: dbConfig.username,
          password: dbConfig.password,
        }
      );
    } else {
      this.db = new DATABASE(dbConfig.host, dbConfig.port, dbConfig.dbname);
    }

    this.db.connect((error) => {
      if (error) {
        console.log(
          "[Data-Generator] ERROR: Failed to connect to database",
          error,
          dbConfig
        );
        exit(1);
      }
      console.log("[Data-Generator] Connected to database");
      this.setStatus(ONLINE);
      return callback();
    });
  }

  /**
   * Stop the simulation of this THING
   * @extends from Parent class
   */
  stop() {
    if (this.status === ONLINE || this.status === SIMULATING) {
      this.db.close();
    }
    super.stop();
  }

  /**
   * Override publish data function to publish data via mqtt channel
   * @param {Object} data Data to be published
   * @param {Object} sensor The publisher
   */
  publishData(data, sensor) {
    super.publishData(data,sensor);
    let newData = null;
    if (sensor.devType === "ACTUATOR") {
      newData = new ActuatorSchema(data);
    } else {
      newData = new SensorSchema(data);
    }
    newData.save((err, _data) => {
      if (err) {
        console.error(
          `[${this.thingId}] Failed to save generated data of sensor ${sensor.id}`
        );
        console.error(err);
      } else {
        console.log(
          `[${this.thingId}] ${data.timestamp} ${JSON.stringify(data)}`
        );
      }
    });
  }

  getStats() {
    const stats = super.getStats();
    const {host, port} = this.dbConfig;
    return {...stats, protocol: "MONGODB", host, port};
  }
}

module.exports = DataGenerator;
