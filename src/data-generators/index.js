const { ENACTDB, ActuatorSchema, SensorSchema } = require("../enact-mongoose");
const DataGenerator = require("./DataGenerator");
const { readJSONFile } = require('../utils');

const SENSOR_TYPE = 'sensor';
const ACTUATOR_TYPE = 'actuator';


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
        console.log(`[Actuator ${id}] ${generatedTime} ${JSON.stringify(data)}`);
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
        console.log(`[Sensor ${id}] ${generatedTime} ${JSON.stringify(data)}`);
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
const startGeneratingData = (type, id, timeInterval, _startTime, duration, dataDescription) => {
  const dataGenerator = new DataGenerator(dataDescription, timeInterval);
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
      if (duration && generatedTime - startTime > duration * 1000) {
        console.log(`[${type} ${id}] Stopped generating data!`);
        clearInterval(generatorID);
      }
    });
  }, timeInterval * 1000);
};

readJSONFile(dataConfigFile, (err, dataConfig) => {
  if (err) {
    console.error(`[ERROR] Cannot read the data config file:`, dataConfigFile);
    return;
  }

  const { dbConfig, sensors, actuators } = dataConfig;
  if (!dbConfig) {
    console.error(`[ERROR] Missing database configuration:`, dataConfig);
    return;
  }

  if (dbConfig.USER && dbConfig.PASSWORD) {
    enactDB = new ENACTDB(dbConfig.HOST, dbConfig.PORT, dbConfig.DBNAME, {
      userName: dbConfig.USER,
      password: dbConfig.PASSWORD
    });
  } else {
    enactDB = new ENACTDB(dbConfig.HOST, dbConfig.PORT, dbConfig.DBNAME);
  }

  enactDB.connect(error => {
    if (error) {
      console.log("[ERROR] Failed to connect to database", error, dbConfig);
      exit(1);
    }
    console.log("Connected to database");
    // Generate sensors data
    for (let sIndex = 0; sIndex < sensors.length; sIndex++) {
      const {id, timeInterval, startTime, duration, dataDescription, scale} = sensors[sIndex];
      const nbSensors = scale ? scale : 1;
      if (nbSensors === 1) {
        startGeneratingData(SENSOR_TYPE, id, timeInterval, startTime, duration, dataDescription);
      } else {
        for (let index = 0; index < nbSensors; index++) {
          startGeneratingData(SENSOR_TYPE, `${id}-${index}`, timeInterval, startTime, duration, dataDescription);
        }
      }
    }
    // Generate actuators data
    for (let aIndex = 0; aIndex < actuators.length; aIndex++) {
      const {id, timeInterval, startTime, duration, dataDescription, scale} = actuators[aIndex];
      const nbActuators = scale ? scale : 1;
      if (nbActuators === 1) {
        startGeneratingData(ACTUATOR_TYPE, id, timeInterval, startTime, duration, dataDescription);
      } else {
        for (let index = 0; index < nbActuators; index++) {
          startGeneratingData(ACTUATOR_TYPE, `${id}-${index}`, timeInterval, startTime, duration, dataDescription);
        }
      }
    }

  });
});
