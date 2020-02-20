const mqtt = require('mqtt');
const ActuatedData = require('./ActuatedData');
const { readJSONFile } = require('../utils');

const actuatedDataConfigFile = process.argv[2];

readJSONFile(actuatedDataConfigFile, (err, actuatedDatas) => {
  if (err) {
    console.error(`[ERROR] Cannot read the configuration of Actuated Data:`, actuatedDataConfigFile);
  } else {
    console.log('Number of actuators: ', actuatedDatas.length);
    for (let index = 0; index < actuatedDatas.length; index++) {
      const {id, mqttConfig, dataSource } = actuatedDatas[index];
      const { topic, HOST, PORT, options } = mqttConfig;
      const mqttBroker = `mqtt://${HOST}:${PORT}`;
      const mqttClient = mqtt.connect(mqttBroker, options);

      mqttClient.on('connect', () => {
        console.log(`[Actuator ${id}] connected to ${mqttBroker}`);
        const actuatedData = new ActuatedData(id, topic, dataSource);
        actuatedData.start(mqttClient);
      });

      mqttClient.on('error', (err) => {
        console.error(`[Actuator ${id}] Failed to simulate: `, err);
      });
    }
  }
})