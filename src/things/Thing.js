const Actuator = require('../actuators');
const Sensor = require('../sensors');
const {
  ONLINE,
  OFFLINE,
  SIMULATING,
} = require('../DeviceStatus');
/**
 * The Thing class presents a THING component:
 * - List of sensors
 * - List of actuators
 * - Possibility to communicate with a gateway
 *  + send data - to multiple channels: `things/thing-id/sensors/sensor-id`
 *  + receive data - listen to multiple channels: `things/thing-id/actuators/#`
 */
class Thing {
  constructor(id) {
    this.id = id;
    this.sensors = [];
    this.actuators = [];
    this.status = OFFLINE; // OFFLINE | ONLINE | SIMULATING | PAUSE | STOP
  }

  /**
   *  Default publish data
   * @param {Object} data Data to be published
   * @param {String} publishID The publisher id
   */
  publishData(data, publishID, options = null) {
    console.log(`[${this.id}] ${publishID} going to publish data: `, data);
  }

  /**
   * Get status of the THING
   */
  getStatus() {
    return this.status;
  }

  /**
   * Set new status of the THING
   * @param {String} newStatus New status: OFFLINE | ONLINE | SIMULATING | PAUSE | STOP
   */
  setStatus(newStatus) {
    this.status = newStatus;
  }

  /**
   * Add a new Sensor into the current THING
   * The sensor collect the data (generate randomly or from database) and publish the data to the gateway via mqtt broker
   * @param {String} id ID of the sensor
   * @param {String} name Name of the sensor
   * @param {Boolean} isFromDatabase true - read from database | false - otherwise
   * @param {Number} timePeriod The time period to publish a data
   * @param {Object} options Options: { maxNumberOfMessage, timeBeforeFailed, dbClient, sensorBehaviours, energy, sources, metaData }
   * @param {Object} options The publish options
   */
  addSensor (id, sensorData) {
    if (this.sensors[id]) {
      console.error(`[${this.id}] Sensor ID ${id} has already existed!`);
      return false;
    }
    const newSensor = new Sensor(id, sensorData, (data, publishID, options) => {
      this.publishData(data, publishID, options);
    });
    this.sensors.push(newSensor);
    // HOT reload sensor
    if (this.status === SIMULATING ) {
      this.sensors[this.sensors.length - 1].start();
    }
    console.log(`[${this.id}] added new sensor ${id}`);
    return true;
  }

  /**
   * Add a new Actuator into the current THING
   * The actuator receives the acuated data from the gateway and printout the status
   * @param {String} id The actuator's ID
   */
  addActuator (id) {
    if (this.actuators[id]) {
      console.error(`[${this.id}] Actuator ID ${id} has already existed!`);
      return null;
    }
    const newActuator = new Actuator(id);
    this.actuators.push(newActuator);
    console.log(`[${this.id}] added new actuator ${id}`);
    return newActuator;
  }

  /**
   * Initialise the THING
   * @param {Function} callback The callback function
   */
  initThing(callback) {
    console.log(`[${this.id}] initializing...`);
    this.status = ONLINE;
    return callback();
  }

  /**
   * Start the simulation of this THING
   */
  start() {
    switch (this.getStatus()) {
      case ONLINE:
        this.sensors.map((sensor) => sensor.start());
        this.setStatus(SIMULATING);
        break;
      case OFFLINE:
        console.error(`[${this.id}] must be online before starting simulation: ${this.getStatus()}`);
        break;
      case SIMULATING:
        console.log(`[${this.id}] is simulating!`);
        break;
      default:
        break;
    }
  }

  /**
   * Stop the simulation of this THING
   */
  stop() {
    switch (this.getStatus()) {
      case OFFLINE:
        console.error(`[${this.id}] ERROR: offline!`);
        break;
      case ONLINE:
        this.setStatus(OFFLINE);
        break;
      case SIMULATING:
        console.log(`[${this.id}] going to stop the simulation!`);
        this.sensors.map((sensor) => sensor.stop());
        this.setStatus(OFFLINE);
        break;
      default:
        break;
    }
  }
}

module.exports = Thing;