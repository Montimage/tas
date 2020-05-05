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
 * @param {Object} connConfig The communication configuration
 * @param {Array} sensors List of sensors
 * @param {Array} actuators List of actuator
 */
const createThing = (thingId, protocol, connConfig, actuators, behaviours, timeToDown) => {
  let Thing = ThingMQTT; // MQTT protocol by default
  if (protocol.toUpperCase() === "STOMP") {
    Thing = ThingSTOMP; // Switch to STOMP protocol
  }
  // Add more protocol here
  const th = new Thing(thingId);
  th.initThing(() => {
    // Add actuators
    if (actuators) {
      for (let aIndex = 0; aIndex < actuators.length; aIndex++) {
        const actuatorData = actuators[aIndex];
        actuatorData["devType"] = "ACTUATOR";
        const { id, scale, enable, objectId, topic } = actuatorData;
        let topicPrefix = `things/${thingId}/actuators${objectId ? `/${objectId}`:''}/`;
        if (enable === false) continue;
        let nbActuators = scale ? scale : 1;
        if (nbActuators === 1) {
          if (!topic) {
            actuatorData['topic'] = `${topicPrefix}${id}`;
          }
          th.addSensor(id, actuatorData, objectId);
        } else {
          for (
            let actuatorIndex = 0;
            actuatorIndex < nbActuators;
            actuatorIndex++
          ) {
            const sID = `${id}-${actuatorIndex}`;
            if (!topic) {
              actuatorData['topic'] = `${topicPrefix}${sID}`;
            }
            th.addSensor(sID, actuatorData, objectId);
          }
        }
      }
    }
    if (behaviours && behaviours.length > 0) {
      for (let index = 0; index < behaviours.length; index++) {
        th.addBehaviour(behaviours[index]);
      }
    }
    if (timeToDown > 0) th.timeToDown = timeToDown;
    th.start();
    allThings.push(th);
  }, connConfig);
};

/**
 * Start the simulation
 * @param {Array} thingConfigs The list of things
 */
const startSimulation = (thingConfigs) => {
  for (let index = 0; index < thingConfigs.length; index++) {
    const { scale, id, protocol, connConfig, actuators, enable, behaviours, timeToDown } = thingConfigs[index];
    if (enable === false) continue;
    let nbThings = scale ? scale : 1;
    const proto = protocol.toUpperCase();
    if (nbThings === 1) {
      createThing(id, proto, connConfig, actuators, behaviours, timeToDown);
    } else {
      for (let tIndex = 0; tIndex < nbThings; tIndex++) {
        const tID = `${id}-${tIndex}`;
        createThing(tID, proto, connConfig, actuators, behaviours, timeToDown);
      }
    }
  }
};

if (process.argv[2] === "test") {
  readJSONFile(process.argv[3], (err, thingConfigs) => {
    if (err) {
      console.error(
        `[Actuated] [ERROR] Cannot read the config of thing:`,
        process.argv[3]
      );
      // console.error();
    } else {
      if (!thingConfigs.things || thingConfigs.things.length === 0) {
        console.error(
          `[Actuated] [ERROR] There is no simulator:`,
          process.argv[3]
        );
      } else {
        startSimulation(thingConfigs.things);
      }
    }
  });
}

module.exports = {
  startSimulation,
  stopSimulation,
};
