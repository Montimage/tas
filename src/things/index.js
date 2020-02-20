const Thing = require('./Thing');
const { readJSONFile } = require('../utils');

const thingConfigFile = process.argv[2];

readJSONFile(thingConfigFile, (err, thingConfig) => {
  if (err) {
    console.error(`[ERROR] Cannot read the config of thing:`, thingConfigFile);
  } else {
    const { id, mqttConfig, sensors, actuators } = thingConfig;
    const th = new Thing(id, mqttConfig);
    th.connectToMQTT(() => {
      // Add sensors
      for (let sIndex = 0; sIndex < sensors.length; sIndex++) {
        const {id, dataSource } = sensors[sIndex];
        th.addSensor(id, dataSource);
      }

      // Add actuators
      for (let aIndex = 0; aIndex < actuators.length; aIndex++) {
        const {id} = actuators[aIndex];
        th.addActuator(id);
      }

      // Start the simulation
      th.start();

      // Stop the simulation after 20s
      // setTimeout(() => {
      //   th.stop();
      // }, 20000);
    });
  }
});