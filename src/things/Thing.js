const Actuator = require('../actuators');
const Sensor = require('../sensors');
const {
  ONLINE,
  OFFLINE,
  SIMULATING,
} = require('../DeviceStatus');
const isExist = (id, objectId, array) => {
  for (let index = 0; index < array.length; index++) {
    const element = array[index];
    if (element.id === id && objectId === element.objectId) return true;
  }
  return false;
}

/**
 * The Thing class presents a THING component:
 * - List of sensors
 * - List of actuators
 * - Possibility to communicate with a gateway
 *  + send data - to multiple channels: `things/thing-id/sensors/sensor-id`
 *  + receive data - listen to multiple channels: `things/thing-id/actuators/#`
 */
class Thing {
  constructor(thingId) {
    this.thingId = thingId;
    this.sensors = [];
    this.actuators = [];
    this.status = OFFLINE; // OFFLINE | ONLINE | SIMULATING | PAUSE | STOP
  }

  /**
   *  Default publish data
   * @param {Object} data Data to be published
   * @param {Object} publisher The publisher
   */
  publishData(data, publisher) {
    console.log(`[${this.thingId}] ${publishID} going to publish data: `, data);
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
   * @param {Object} sensorData Sensor data
   * @param {String} objectId The object id of the sensor follow IP Smart Object Standard
   */
  addSensor (id, sensorData, objectId = null) {
    if (isExist(id, objectId, this.sensors)) {
      console.error(`[${this.thingId}] Sensor ID ${id} ${objectId} has already existed!`);
      return null;
    }

    const newSensor = new Sensor(id, sensorData, (data, publisher) => {
      this.publishData(data, publisher);
    });

    this.sensors.push(newSensor);
    // HOT reload sensor
    if (this.status === SIMULATING ) {
      this.sensors[this.sensors.length - 1].start();
    }
    console.log(`[${this.thingId}] added new sensor ${id} ${objectId}`);
    return true;
  }

  /**
   * Add a new Actuator into the current THING
   * The actuator receives the acuated data from the gateway and printout the status
   * @param {String} id The actuator's ID
   */
  addActuator (id, actuatorData, objectId = null) {
    if (isExist(id, objectId, this.actuators)) {
      console.error(`[${this.thingId}] Actuator ID ${id} ${objectId} has already existed!`);
      return null;
    }
    const newActuator = new Actuator(id, actuatorData);
    this.actuators.push(newActuator);
    console.log(`[${this.thingId}] added new actuator ${id} ${objectId}`);
    return newActuator;
  }

  /**
   * Initialise the THING
   * @param {Function} callback The callback function
   */
  initThing(callback) {
    console.log(`[${this.thingId}] initializing...`);
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
        console.error(`[${this.thingId}] must be online before starting simulation: ${this.getStatus()}`);
        break;
      case SIMULATING:
        console.log(`[${this.thingId}] is simulating!`);
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
        console.error(`[${this.thingId}] ERROR: offline!`);
        break;
      case ONLINE:
        this.setStatus(OFFLINE);
        break;
      case SIMULATING:
        console.log(`[${this.thingId}] going to stop the simulation!`);
        this.sensors.map((sensor) => sensor.stop());
        this.setStatus(OFFLINE);
        break;
      default:
        break;
    }
  }
}

module.exports = Thing;