const mqtt = require("mqtt");
const Actuator = require('../actuators');
const Sensor = require('../sensors');
const {
  ONLINE,
  OFFLINE,
  SIMULATING,
} = require('../constants');
/**
 * The Thing class presents a THING component:
 * - List of sensors
 * - List of actuators
 * - Possibility to communicate with a gateway
 *  + send data - to multiple channels: `things/thing-id/sensors/sensor-id`
 *  + receive data - listen to multiple channels: `things/thing-id/actuators/#`
 */
class Thing {
  constructor(id, mqttConfig) {
    this.id = id;
    this.mqttConfig = mqttConfig;
    this.mqttClient = null;
    this.sensors = [];
    this.sensorIDs = {};
    this.actuators = [];
    this.actuatorIDs = {};
    this.actuatedTopic = `things/${id}/actuators/`;
    this.status = OFFLINE; // OFFLINE | ONLINE | SIMULATING | PAUSE | STOP
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
   * handle actuated data
   * @param {String} topic topic of the received packet
   * @param {String} message payload of the received packet
   * @param {Object} packet received packet, as defined in mqtt-packet
   */
  handleMessage (topic, message, packet) {
    if (topic.startsWith(this.actuatedTopic)) {
      const subTopic = topic.replace(this.actuatedTopic,'');
      const array = subTopic.split('/');
      // find the actuator id in the subtopic
      for (let aIndex = 0; aIndex < this.actuators.length; aIndex++) {
        const actuator = this.actuators[aIndex];
        if (array.indexOf(actuator.id) > -1) {
          actuator.updateActuatedData(message);
          return actuator.showStatus();
        }
      }
      console.error(`[ERROR] Cannot find the actuator ${array[4]}`);
    } else {
      console.log('[DEBUG] Ignore message: ', topic, message);
    }
  }

  /**
   * Connect to MQTT broker server
   */
  connectToMQTT(callback) {
    if (this.mqttClient) {
      return callback();
    } else {
      const mqttBrokerURL = `mqtt://${this.mqttConfig.HOST}:${this.mqttConfig.PORT}`;
      let mqttClient = null;
      if (this.mqttConfig.options) {
        mqttClient = mqtt.connect(mqttBrokerURL, this.mqttConfig.options);
      } else {
        mqttClient = mqtt.connect(mqttBrokerURL);
      }

      mqttClient.on('connect', () => {
        console.log(`[THING] THING ${this.id} has connected to MQTT broker ${mqttBrokerURL}`);
        this.mqttClient = mqttClient;
        this.setStatus(ONLINE);
        // Subscribe to get the downstream data for actuators
        this.mqttClient.subscribe(`${this.actuatedTopic}#`);
        console.log(`[Thing ${this.id}] listening actuated data on channel: ${this.actuatedTopic}#`);
        callback();
      });

      mqttClient.on('error', (err) => {
        console.error('[ERROR] Cannot connect to MQTT broker', err);
      });

      mqttClient.on('offline', () => {
        console.log(`[THING] THING ${this.id} has gone offline!`);
        this.setStatus(OFFLINE);
      });

      mqttClient.on('message', (topic, message, packet) => {
        // console.log(`[Thing ${this.id}] received message on topic: ${topic}`);
        this.handleMessage(topic, message.toString(), packet);
      });
    }
  }

  /**
   * Add a new Sensor into the current THING
   * The sensor collect the data (generate randomly or from database) and publish the data to the gateway via mqtt broker
   * @param {String} id The sensor's ID
   * @param {Object} dataSource The description of the data source of the sensors (see the Sensor class for more information)
   */
  addSensor (id, dataSource) {
    if (this.sensors[id]) {
      console.error(`[ERROR] Sensor ID ${id} has already existed!`);
      return false;
    }
    const topic = `things/${this.id}/sensors/${id}`;
    const newSensor = new Sensor(id, topic, dataSource);
    this.sensorIDs[id] = id;
    this.sensors.push(newSensor);
    // HOT reload sensor
    if (this.status === SIMULATING && this.mqttClient) {
      this.sensors[this.sensors.length - 1].start(this.mqttClient);
    }
    return true;
  }

  /**
   * Add a new Actuator into the current THING
   * The actuator receives the acuated data from the gateway and printout the status
   * @param {String} id The actuator's ID
   */
  addActuator (id) {
    if (this.actuators[id]) {
      console.error(`[ERROR] Actuator ID ${id} has already existed!`);
      return false;
    }
    const newActuator = new Actuator(id);
    this.actuatorIDs[id] = id;
    this.actuators.push(newActuator);
    return true;
  }

  /**
   * Start the simulation of this THING
   */
  start() {
    switch (this.getStatus()) {
      case ONLINE:
        this.sensors.map((sensor) => sensor.start(this.mqttClient));
        this.setStatus(SIMULATING);
        break;
      case OFFLINE:
        console.error(`[ERROR] THING ${this.id} must be online before starting simulation: ${this.getStatus()}`);
        break;
      case SIMULATING:
        console.warn(`[THING] ${this.id} is simulating!`);
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
        console.error(`[ERROR] THING ${this.id} is offline!`);
        break;
      case ONLINE:
        this.setStatus(OFFLINE);
        this.mqttClient.end();
        break;
      case SIMULATING:
        console.log(`[Thing ${this.id}] Going to stop the simulation!`);
        this.sensors.map((sensor) => sensor.stop());
        this.setStatus(OFFLINE);
        this.mqttClient.end();
        break;
      default:
        break;
    }
  }
}

module.exports = Thing;