const ThingMongoDB = require("../things/ThingMongoDB");
const { readJSONFile } = require("../utils");

const allThings = [];
/**
 * Stop the simulation
 */
const stopDataGenerator = () => {
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
const createDataGenerator = (id, connConfig, sensors, actuators) => {
  // Add more protocol here
  const th = new ThingMongoDB(id);
  th.initThing(() => {
    // Add sensors
    if (sensors) {
      for (let sIndex = 0; sIndex < sensors.length; sIndex++) {
        const sensorData = sensors[sIndex];
        sensorData['devType'] = "SENSOR";
        const { id, scale, enable } = sensorData;
        if (enable === false) continue;
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
        actuatorData['devType'] = "ACTUATOR";
        const { id, scale, enable } = actuatorData;
        if (enable === false) continue;
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
  }, connConfig);
};

/**
 * Start the simulation
 * @param {Array} generatorConfigs The list of things
 */
const startDataGenerator = (generatorConfigs) => {
  for (let index = 0; index < generatorConfigs.length; index++) {
    const { id, protocol, connConfig, sensors, actuators, enable } = generatorConfigs[
      index
    ];
    if (protocol.toUpperCase() !== "DATABASE") {
      console.error(`[Data-Generator] ERROR: Unsupported protocol ${protocol}`);
      continue;
    }
    if (enable === false) continue;
    createDataGenerator(id, connConfig, sensors, actuators);
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
      if (!generatorConfigs.things || generatorConfigs.things.length === 0) {
        console.error(
          `[Data-Generator] ERROR: Cannt find generator configuration:`,
          process.argv[3]
        );
      } else {
        startDataGenerator(generatorConfigs.things);
      }
    }
  });
}

module.exports = {
  startDataGenerator,
  stopDataGenerator,
};
