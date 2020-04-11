const ThingMQTT = require("../things/ThingMQTT");
const ThingSTOMP = require("../things/ThingSTOMP");
const { readJSONFile } = require("../utils");

const allThings = [];
/**
 * Stop the simulation
 */
const stopSimulation = () => {
  for (let index = 0; index < allThings.length; index++) {
    const th = allThings[index];
    th.stop();
  }
};

/**
 * Create a thing
 * @param {String} id The id of the thing
 * @param {String} protocol The protocol of the communication
 * @param {Object} commConfig The communication configuration
 * @param {Array} sensors List of sensors
 * @param {Array} actuators List of actuator
 */
const createThing = (id, protocol, commConfig, sensors, actuators) => {
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
        if (!sensorData.options) {
          sensorData["options"] = {};
        }
        sensorData.options["devType"] = "SENSOR";
        const { id, scale, disable } = sensorData;
        if (disable) continue;
        let nbSensors = scale ? scale : 1;
        if (nbSensors === 1) {
          th.addSensor(id, sensorData);
        } else {
          for (let sensorIndex = 0; sensorIndex < nbSensors; sensorIndex++) {
            const sID = `${id}-${sensorIndex}`;
            th.addSensor(sID, sensorData);
          }
        }
      }
    }
    // Add actuators
    if (actuators) {
      for (let aIndex = 0; aIndex < actuators.length; aIndex++) {
        const { id, scale, disable, options } = actuators[aIndex];
        if (disable) continue;
        let nbActuators = scale ? scale : 1;
        if (nbActuators === 1) {
          th.addActuator(id, options);
        } else {
          for (
            let actuatorIndex = 0;
            actuatorIndex < nbActuators;
            actuatorIndex++
          ) {
            const actID = `${id}-${actuatorIndex}`;
            th.addActuator(actID, options);
          }
        }
      }
    }

    th.start();

    allThings.push(th);
  }, commConfig);
};

/**
 * Start the simulation
 * @param {Array} thingConfigs The list of things
 */
const startSimulation = (thingConfigs) => {
  for (let index = 0; index < thingConfigs.length; index++) {
    const {
      scale,
      id,
      protocol,
      commConfig,
      sensors,
      actuators,
    } = thingConfigs[index];
    let nbThings = scale ? scale : 1;
    const proto = protocol.toUpperCase();
    if (nbThings === 1) {
      createThing(id, proto, commConfig, sensors, actuators);
    } else {
      for (let tIndex = 0; tIndex < nbThings; tIndex++) {
        const tID = `${id}-${tIndex}`;
        createThing(tID, proto, commConfig, sensors, actuators);
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
      startSimulation(thingConfigs);
    }
  });
}

module.exports = {
  startSimulation,
  stopSimulation,
};
