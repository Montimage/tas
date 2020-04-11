const { ENACTDB, ActuatorSchema, SensorSchema } = require("../enact-mongoose");
const Thing = require('./Thing');
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
class DataGenerator extends Thing {
  constructor(id) {
    super(id);
    this.enactDB = null;
  }

  /**
   * handle actuated data
   * @param {String} topic topic of the received packet
   * @param {String} message payload of the received packet
   * @param {Object} packet received packet, as defined in mqtt-packet
   */
  handleMQTTMessage (topic, message, packet) {
    console.log(`[${this.id}] received: ${this.mqttClient.options.href} ${topic}`, message);
    if (this.mqttTopics[topic]) {
      // Check for the custom topic first
      const actuators = this.mqttTopics[topic];
      for (let index = 0; index < actuators.length; index++) {
        const actuator = actuators[index];
        actuator.updateActuatedData(message);
        actuator.showStatus();
      }
    } else {
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
        console.error(`[${this.id}] ERROR: cannot find the actuator ${array[4]}`);
      } else {
        console.log(`[${this.id}] Ignore message: `, topic, message);
      }
    }
  }

  /**
   * Override the @Thing.initThing() function to initialise the MQTT client
   * @param {Function} callback The callback function
   */
  initThing(callback, dbConfig) {
    if (!dbConfig) {
      console.error(`[Data-Generator] ERROR: Missing database configuration:`, dataConfig);
      return;
    }

    if (dbConfig.user && dbConfig.password) {
      this.enactDB = new ENACTDB(dbConfig.host, dbConfig.port, dbConfig.dbname, {
        userName: dbConfig.user,
        password: dbConfig.password
      });
    } else {
      this.enactDB = new ENACTDB(dbConfig.host, dbConfig.port, dbConfig.dbname);
    }

    this.enactDB.connect(error => {
      if (error) {
        console.log("[Data-Generator] ERROR: Failed to connect to database", error, dbConfig);
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
      this.enactDB.close();
    }
    super.stop();
  }

  /**
   * Override publish data function to publish data via mqtt channel
   * @param {Object} data Data to be published
   * @param {String} publishID The ID of the publisher
   */
  publishData(data, publishID, options = null) {
    if (options.devType === 'SENSOR') {
      const newSensor = new SensorSchema({
        timestamp: data.timestamp,
        id: publishID,
        value: data.value
      });
      newSensor.save((err, _data) => {
        if (err) {
          console.error(`[${this.id}] Failed to save generated data of sensor ${publishID}`);
          console.error(err);
        } else {
          console.log(`[${this.id}] ${data.timestamp} ${JSON.stringify(data)}`);
        }
      });
    } else if (options.devType === 'ACTUATOR') {
      const newActuator = new ActuatorSchema({
        timestamp: data.timestamp,
        id: data.id,
        value: data.value
      });
      newActuator.save((err, _data) => {
        if (err) {
          console.error(`[${this.id}] Failed to save generated data of actuator ${publishID}`);
          console.error(err);
        } else {
          console.log(`[${this.id}] ${data.timestamp} ${JSON.stringify(data)}`);
        }
      });
    } else {
      console.error(`[${this.id}] ERROR: Invalid data type ${options.devType}`);
    }
  }
}

module.exports = DataGenerator;