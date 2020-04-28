const ThingMQTT = require("../things/ThingMQTT");
const ThingSTOMP = require("../things/ThingSTOMP");
const { readJSONFile } = require("../utils");

const allThings = [];
/**
 * Stop the simulation
 */
const stopSimulator = () => {
  for (let index = 0; index < allThings.length; index++) {
    const th = allThings[index];
    th.stop();
  }
};

/**
 * Create a thing
 * @param {String} id The id of the thing
 * @param {String} protocol The protocol of the communication
 * @param {Object} connConfig The communication configuration
 * @param {Array} sensors List of sensors
 * @param {Array} actuators List of actuator
 */
const createThing = (id, protocol, connConfig, sensors, actuators) => {
  let Thing = ThingMQTT; // MQTT protocol by default
  if (protocol.toUpperCase() === "STOMP") {
    Thing = ThingSTOMP; // Switch to STOMP protocol
  }
  // Add more protocol here
  const th = new Thing(id);
  th.initThing(() => {
    // Add sensors
    if (sensors) {
      for (let sIndex = 0; sIndex < sensors.length; sIndex++) {
        const sensorData = sensors[sIndex];
        sensorData['devType'] = 'SENSOR';
        const { id, scale, enable, objectId } = sensorData;
        if (enable === false) continue;
        let nbSensors = scale ? scale : 1;
        if (nbSensors === 1) {
          th.addSensor(id, sensorData, objectId);
        } else {
          for (let sensorIndex = 0; sensorIndex < nbSensors; sensorIndex++) {
            const sID = `${id}-${sensorIndex}`;
            th.addSensor(sID, sensorData, objectId);
          }
        }
      }
    }
    // Add actuators
    if (actuators) {
      for (let aIndex = 0; aIndex < actuators.length; aIndex++) {
        const actuatorData = actuators[aIndex];
        const { id, scale, enable, objectId } = actuatorData;
        if (enable === false) continue;
        let nbActuators = scale ? scale : 1;
        if (nbActuators === 1) {
          th.addActuator(id, actuatorData, objectId);
        } else {
          for (
            let actuatorIndex = 0;
            actuatorIndex < nbActuators;
            actuatorIndex++
          ) {
            const actID = `${id}-${actuatorIndex}`;
            th.addActuator(actID, actuatorData, objectId);
          }
        }
      }
    }

    th.start();

    allThings.push(th);
  }, connConfig);
};

/**
 * Start the simulation
 * @param {Array} thingConfigs The list of things
 */
const startSimulator = (thingConfigs) => {
  for (let index = 0; index < thingConfigs.length; index++) {
    const {
      scale,
      id,
      protocol,
      connConfig,
      sensors,
      actuators,
      enable,
    } = thingConfigs[index];
    if (enable === false) continue; // skip this thing
    let nbThings = scale ? scale : 1;
    const proto = protocol.toUpperCase();
    if (nbThings === 1) {
      createThing(id, proto, connConfig, sensors, actuators);
    } else {
      for (let tIndex = 0; tIndex < nbThings; tIndex++) {
        const tID = `${id}-${tIndex}`;
        createThing(tID, proto, connConfig, sensors, actuators);
      }
    }
  }
};

if (process.argv[2] === "test") {
  readJSONFile(process.argv[3], (err, thingConfigs) => {
    if (err) {
      console.error(
        `[Simulation] [ERROR] Cannot read the config of thing:`,
        process.argv[3]
      );
      // console.error();
    } else {
      if (!thingConfigs.things || thingConfigs.things.length === 0) {
        console.error(
          `[Simulation] [ERROR] There is no simulation:`,
          process.argv[3]
        );
      } else {
        startSimulator(thingConfigs.things);
      }
    }
  });
}

module.exports = {
  startSimulator,
  stopSimulator,
};
