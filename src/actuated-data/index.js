const mqtt = require('mqtt');
const ActuatedData = require('./ActuatedData');
const { readJSONFile } = require('../utils');

const actuatedDataConfigFile = process.argv[2];

/**
 * Create an Actuated Data
 * @param {String} id The id of the actuated data
 * @param {Object} commConfig The configuration of mqtt broker
 * @param {Object} dataSource The data source of actuated data
 */
const createActuatedData = (id, commConfig, dataSource) => {
  const { topic, host, port, options } = commConfig;
  const mqttBroker = `mqtt://${host}:${port}`;
  const mqttClient = mqtt.connect(mqttBroker, options);

  const publishFct = (data) => {
    // super.publishData(data,publishID);
    console.log(`[${id}] published: ${mqttClient.options.href} ${topic}`, data);
    mqttClient.publish(topic, JSON.stringify(data));
  }

  mqttClient.on("connect", () => {
    console.log(`[${id}] connected to ${mqttBroker}`);
    const actuatedData = new ActuatedData(id, dataSource, publishFct);
    actuatedData.start();
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
      const {id, commConfig, dataSource, scale } = actuatedDatas[index];
      const nbActuators = scale ? scale : 1;
      if (nbActuators === 1) {
        createActuatedData(id, commConfig, dataSource);
      } else {
        for (let aIndex = 0; aIndex < nbActuators; aIndex++) {
          createActuatedData(`${id}-${aIndex}`, {...commConfig, topic: `${commConfig.topic}-${aIndex}`}, dataSource);
        }
      }
    }
  }
})