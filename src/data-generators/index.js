const { ENACTDB, ActuatorSchema, SensorSchema } = require("../enact-mongoose");
const DataGenerator = require("./DataGenerator");
const { readJSONFile } = require('../utils');

const SENSOR_TYPE = 'sensor';
const ACTUATOR_TYPE = 'actuator';

let stopGenerating = false;

let enactDB = null; // Enact MongoDB Client
const dataConfigFile = process.argv[2]; // the path to data configuration file

/**
 * Save a generated data into database
 * @param {String} type The type of device: sensor or actuator
 * @param {String} id The id of the device
 * @param {Object} data The data to be stored
 * @param {Number} generatedTime The generated time of the data
 */
const saveData = (type, id, data, generatedTime) => {
  if (type == ACTUATOR_TYPE) {
    const newActuator = new ActuatorSchema({
      timestamp: generatedTime,
      actID: id,
      value: JSON.stringify(data)
    });
    newActuator.save((err, _data) => {
      if (err) {
        console.error(`[ERROR] Failed to save generated data of actuator ${id}`);
      } else {
        console.log(`[${id}] ${generatedTime} ${JSON.stringify(data)}`);
      }
    });
  } else if (type == SENSOR_TYPE) {
    const newSensor = new SensorSchema({
      timestamp: generatedTime,
      sensorID: id,
      value: JSON.stringify(data)
    });
    newSensor.save((err, _data) => {
      if (err) {
        console.error(`[ERROR] Failed to save generated data of sensor ${id}`);
      } else {
        console.log(`[${id}] ${generatedTime} ${JSON.stringify(data)}`);
      }
    });
  }
};

/**
 * Start generating data for a device
 * @param {String} type The type of the device
 * @param {String} id The id of the device
 * @param {Number} timeInterval The generating time interval - in seconds
 * @param {Number} _startTime The generating started time - in timestamp format
 * @param {Number} duration The duration of the generating - in seconds
 * @param {Object} dataDescription The definition of the genereated data
 */
const startGenerating = (type, id, _startTime, duration, dataSource) => {
  const { dataDescription } = dataSource;
  const { timeInterval } = dataDescription;
  const dataGenerator = new DataGenerator(dataDescription);
  let timeDelta = 0;
  let startTime = _startTime;
  if (!startTime) {
    startTime = Date.now();
  } else {
    timeDelta = Date.now() - startTime;
  }
  console.log(
    `Generate randomly data ${dataDescription.type} and publish the data in every ${timeInterval} seconds`
  );
  console.log(
    `Start Time ${startTime} and duration time ${duration} seconds`
  );
  let generatorID = setInterval(() => {
    dataGenerator.generateData(data => {
      const generatedTime = Date.now() - timeDelta;
      saveData(type, id, data, generatedTime);
      if ((duration && generatedTime - startTime > duration * 1000) || stopGenerating ) {
        console.log(`[${id}] Stopped generating data!`);
        if (enactDB) {
          enactDB.close();
        }
        clearInterval(generatorID);
      }
    });
  }, timeInterval * 1000);
};

const stopGeneratingData = () => {
  stopGenerating = true;
}

/**
 * Start generating data
 * @param {Object} dataConfig The configuration of the data generator
 */
const startGeneratingData = (dataConfig) => {

  const { dbConfig, sensors, actuators } = dataConfig;
  if (!dbConfig) {
    console.error(`[ERROR] Missing database configuration:`, dataConfig);
    return;
  }

  if (dbConfig.user && dbConfig.password) {
    enactDB = new ENACTDB(dbConfig.host, dbConfig.port, dbConfig.dbname, {
      userName: dbConfig.user,
      password: dbConfig.password
    });
  } else {
    enactDB = new ENACTDB(dbConfig.host, dbConfig.port, dbConfig.dbname);
  }

  enactDB.connect(error => {
    if (error) {
      console.log("[ERROR] Failed to connect to database", error, dbConfig);
      exit(1);
    }
    console.log("Connected to database");
    // Generate sensors data
    for (let sIndex = 0; sIndex < sensors.length; sIndex++) {
      const {id, startTime, duration, dataSource, scale} = sensors[sIndex];
      const nbSensors = scale ? scale : 1;
      if (nbSensors === 1) {
        startGenerating(SENSOR_TYPE, id, startTime, duration, dataSource);
      } else {
        for (let index = 0; index < nbSensors; index++) {
          startGenerating(SENSOR_TYPE, `${id}-${index}`, startTime, duration, dataSource);
        }
      }
    }
    // Generate actuators data
    for (let aIndex = 0; aIndex < actuators.length; aIndex++) {
      const {id, startTime, duration, dataSource, scale} = actuators[aIndex];
      const nbActuators = scale ? scale : 1;
      if (nbActuators === 1) {
        startGenerating(ACTUATOR_TYPE, id, startTime, duration, dataSource);
      } else {
        for (let index = 0; index < nbActuators; index++) {
          startGenerating(ACTUATOR_TYPE, `${id}-${index}`, startTime, duration, dataSource);
        }
      }
    }

  });
}

if (process.argv[2] === 'run') {
  readJSONFile(process.argv[3], (err, dataConfig) => {
    if (err) {
      console.error(`[ERROR] Cannot read the data config file:`, dataConfigFile);
      return;
    }
    startGeneratingData(dataConfig);
  });
}

module.exports = {
  startGeneratingData,
  stopGeneratingData
}