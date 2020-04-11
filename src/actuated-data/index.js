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
const createThing = (id, protocol, commConfig, actuators) => {
  let Thing = ThingMQTT; // MQTT protocol by default
  if (protocol.toUpperCase() === "STOMP") {
    Thing = ThingSTOMP; // Switch to STOMP protocol
  }
  // Add more protocol here
  const th = new Thing(id);
  th.initThing(() => {
    // Add actuators
    if (actuators) {
      for (let aIndex = 0; aIndex < actuators.length; aIndex++) {
        const actuatorData = actuators[aIndex];
        if (!actuatorData.options) {
          actuatorData["options"] = {};
        }
        actuatorData.options["devType"] = "ACTUATOR";
        const { id, scale, disable } = actuatorData;
        if (disable) continue;
        let nbActuators = scale ? scale : 1;
        if (nbActuators === 1) {
          th.addSensor(id, actuatorData);
        } else {
          for (
            let actuatorIndex = 0;
            actuatorIndex < nbActuators;
            actuatorIndex++
          ) {
            const sID = `${id}-${actuatorIndex}`;
            th.addSensor(sID, actuatorData);
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
    const { scale, id, protocol, commConfig, actuators } = thingConfigs[index];
    let nbThings = scale ? scale : 1;
    const proto = protocol.toUpperCase();
    if (nbThings === 1) {
      createThing(id, proto, commConfig, actuators);
    } else {
      for (let tIndex = 0; tIndex < nbThings; tIndex++) {
        const tID = `${id}-${tIndex}`;
        createThing(tID, proto, commConfig, actuators);
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
