const ThingMongoDB = require("../things/ThingMongoDB");
const { readJSONFile } = require("../utils");

const allThings = [];
/**
 * Stop the simulation
 */
const stopGenerator = () => {
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
const createDataGenerator = (id, commConfig, sensors, actuators) => {
  // Add more protocol here
  const th = new ThingMongoDB(id);
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
 * @param {Array} generatorConfigs The list of things
 */
const startGenerator = (generatorConfigs) => {
  for (let index = 0; index < generatorConfigs.length; index++) {
    const { id, protocol, commConfig, sensors, actuators } = generatorConfigs[
      index
    ];
    if (protocol.toUpperCase() !== "DATABASE") {
      console.error(`[Data-Generator] ERROR: Unsupported protocol ${protocol}`);
      continue;
    }
    createDataGenerator(id, commConfig, sensors, actuators);
  }
};

if (process.argv[2] === "test") {
  readJSONFile(process.argv[3], (err, generatorConfigs) => {
    if (err) {
      console.error(
        `[Data-Generator] ERROR: Cannot read the config of thing:`,
        process.argv[3]
      );
      // console.error();
    } else {
      startGenerator(generatorConfigs);
    }
  });
}

module.exports = {
  startGenerator,
  stopGenerator,
};
