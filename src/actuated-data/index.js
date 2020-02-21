const mqtt = require('mqtt');
const ActuatedData = require('./ActuatedData');
const { readJSONFile } = require('../utils');

const actuatedDataConfigFile = process.argv[2];

/**
 * Create an Actuated Data
 * @param {String} id The id of the actuated data
 * @param {Object} mqttConfig The configuration of mqtt broker
 * @param {Object} dataSource The data source of actuated data
 */
const createActuatedData = (id, mqttConfig, dataSource) => {
  const { topic, HOST, PORT, options } = mqttConfig;
  const mqttBroker = `mqtt://${HOST}:${PORT}`;
  const mqttClient = mqtt.connect(mqttBroker, options);

  mqttClient.on("connect", () => {
    console.log(`[${id}] connected to ${mqttBroker}`);
    const actuatedData = new ActuatedData(id, topic, dataSource);
    actuatedData.start(mqttClient);
  });

  mqttClient.on("error", err => {
    console.error(`[${id}] failed to simulate: `, err);
  });
};

readJSONFile(actuatedDataConfigFile, (err, actuatedDatas) => {
  if (err) {
    console.error(`[ERROR] Cannot read the configuration of Actuated Data:`, actuatedDataConfigFile);
  } else {
    console.log('Number of actuators: ', actuatedDatas.length);
    for (let index = 0; index < actuatedDatas.length; index++) {
      const {id, mqttConfig, dataSource, scale } = actuatedDatas[index];
      const nbActuators = scale ? scale : 1;
      if (nbActuators === 1) {
        createActuatedData(id, mqttConfig, dataSource);
      } else {
        for (let aIndex = 0; aIndex < nbActuators; aIndex++) {
          createActuatedData(`${id}-${aIndex}`, {...mqttConfig, topic: `${mqttConfig.topic}-${aIndex}`}, dataSource);
        }
      }
    }
  }
})