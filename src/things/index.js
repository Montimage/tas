const Thing = require("./Thing");
const { readJSONFile } = require("../utils");

const thingConfigFile = process.argv[2];

const createThing = (id, mqttConfig, sensors, actuators) => {
  console.log(`[${id}] Initializing ...`);
  const th = new Thing(id, mqttConfig);
  th.connectToMQTT(() => {
    // Add sensors
    for (let sIndex = 0; sIndex < sensors.length; sIndex++) {
      const { id, dataSource, scale } = sensors[sIndex];
      let nbSensors = scale ? scale : 1;
      if (nbSensors === 1) {
        th.addSensor(id, dataSource);
      } else {
        for (let sensorIndex = 0; sensorIndex < nbSensors; sensorIndex++) {
          const sID = `${id}-${sensorIndex}`;
          th.addSensor(sID, dataSource);
        }
      }
    }

    // Add actuators
    for (let aIndex = 0; aIndex < actuators.length; aIndex++) {
      const { id, scale } = actuators[aIndex];
      let nbActuators = scale ? scale : 1;
      if (nbActuators === 1) {
        th.addActuator(id);
      } else {
        for (let actuatorIndex = 0; actuatorIndex < nbActuators; actuatorIndex++) {
          const actID = `${id}-${actuatorIndex}`;
          th.addActuator(actID);
        }
      }
    }

    // Start the simulation
    th.start();

    // Stop the simulation after 20s
    // setTimeout(() => {
    //   th.stop();
    // }, 20000);
  });
};

readJSONFile(thingConfigFile, (err, thingConfigs) => {
  if (err) {
    console.error(`[ERROR] Cannot read the config of thing:`, thingConfigFile);
  } else {
    for (let index = 0; index < thingConfigs.length; index++) {
      const { scale, id, mqttConfig, sensors, actuators } = thingConfigs[index];
      let nbThings = scale ? scale : 1;
      if (nbThings === 1) {
        createThing(id, mqttConfig, sensors, actuators);
      } else {
        for (let tIndex = 0; tIndex < nbThings; tIndex++) {
          const tID = `${id}-${tIndex}`;
          createThing(tID, mqttConfig, sensors, actuators);
        }
      }
    }
  }
});
