/*
nodejs index.js <devType> <dev-id> <mqtt-broker-address> <data-sources>
data-sources:
    - random <data-define> <time-interval>: randomly generates regular data based on the data-define
      + data-define: a json file to defined the type of data
      + time-interval: time period to generate data
    - database <host> <port> <collections>: use data from a mongo database.
*/

const mqtt = require("mqtt");
const { ENACTDB, Sensor, Actuator } = require("../enact-mongoose");
const config = require("../config");
const DataGenerator = require("../data-generators/DataGenerator");

const showHelp = () => {
  console.log(`
  Usage:
    node index <dev-type> <dev-id> <mqtt-broker-address> <data-sources>
  Options:
    dev-type    Device type. Can be "sensor" or "actuator"
    dev-id      Device id
    mqtt-broker-address   The address of mqtt-broker server
    data-sources    the source of the data:
      random <data-define> <time-interval>: randomly generates regular data based on the data-define
        data-define: a json file to defined the type of data
        time-interval: time period to generate data
      database <start-time> [end-time]: use data from mongodb
        start-time: the time to start replaying data
        end-time: the time to stop replaying data. If NULL -> until the current time
  `);
}

const invalidArgument = errorMessage => {
  console.error(`[ERROR] cannot start sensor simulator. ${errorMessage}`);
  showHelp();
  process.exit(1);
};

// Clean and exit the simulation
const cleanAndExit = () => {
  if (client) {
    client.end();
  }
};

// Parse the command-line parameters
const devType = process.argv[2];
if (devType === '--help') {
  showHelp();
  process.exit(0);
}

if (process.argv.length < 6) {
  invalidArgument("Missing argument!");
}

if (devType !== "sensor" && devType !== "actuator") {
  invalidArgument('[ERROR] devType must be "sensor" or "actuator"');
}

const devID = process.argv[3];
const client = mqtt.connect(`mqtt://${process.argv[4]}`);
const channel = `${devType === "sensor" ? "sensors" : "actuators"}/${devID}`;

/**
 * Publish data
 * @param {String} strData data to be published
 */
const publishData = strData => {
  console.log("Going to send data", channel, strData);
  client.publish(channel, JSON.stringify(strData));
};

const publishDataWithTimestamp = listData => {
  const startTime = listData[0].timestamp;
  for (let index = 0; index < listData.length; index++) {
    setTimeout(() => {
      const dataToBePublished = JSON.parse(listData[index].value);
      console.log(
        "Going to send data: ",
        index,
        Date.now(),
        listData[index].timestamp
      );
      console.log(dataToBePublished);
      publishData(dataToBePublished);
      if (index === listData.length - 1) {
        cleanAndExit();
      }
    }, listData[index].timestamp - startTime);
  }
};

// Generate data randomly
const generateRandomData = () => {
  if (process.argv.length < 8) {
    cleanAndExit();
    invalidArgument("Missing argument!");
  }
  const dataDescription = JSON.parse(process.argv[6]);
  const timeInterval = Number(process.argv[7]);
  console.log(
    `Generate randomly data ${dataDescription.type} and publish the data in every ${timeInterval} seconds`
  );
  const dataGenerator = new DataGenerator(dataDescription, timeInterval);
  setInterval(() => {
    dataGenerator.generateData(data => {
      console.log(`device ${devID}: `, data);
      publishData(data);
    });
  }, timeInterval * 1000);
};

/**
 * Read data from a database and publish the data based on the timestamp, sensor id
 *
 */
const readDataFromDatabase = () => {
  if (process.argv.length < 7) {
    cleanAndExit();
    invalidArgument("Missing argument!");
  }
  const startTime = process.argv[6];
  const endTime = process.argv[7] ? process.argv[7] : Date.now();
  console.log(
    `Read data from database ${config.DB_HOST}:${config.DB_PORT}/${config.DB_NAME}`
  );
  console.log(`StartTime: ${startTime}, endTime: ${endTime}`);
  let enactDB = null;
  if (config.DB_USER && config.DB_PASSWORD) {
    enactDB = new ENACTDB(config.DB_HOST, config.DB_PORT, config.DB_NAME, {
      userName: config.DB_USER,
      password: config.DB_PASSWORD
    });
  } else {
    enactDB = new ENACTDB(config.DB_HOST, config.DB_PORT, config.DB_NAME);
  }
  enactDB.connect(() => {
    console.log("Connected to database");
    // cons
    if (devType === "sensor") {
      Sensor.findSensorDataBetweenTimes(
        { sensorID: devID },
        startTime,
        endTime,
        (err, listData) => {
          if (err) {
            console.error("[ERROR] Cannot find any sensor", err);
            cleanAndExit();
          } else {
            console.log("Number of data: ", listData.length);
            enactDB.close();
            if (listData.length > 0) {
              publishDataWithTimestamp(listData);
            } else {
              cleanAndExit();
            }
          }
        }
      );
    } else if (devType === "actuator") {
      Actuator.findActuatorDataBetweenTimes(
        { actID: devID },
        startTime,
        endTime,
        (err, listData) => {
          if (err) {
            console.error("[ERROR] Cannot find any actuator", err);
            cleanAndExit();
          } else {
            console.log("Number of data: ", listData.length);
            enactDB.close();
            if (listData.length > 0) {
              publishDataWithTimestamp(listData);
            } else {
              cleanAndExit();
            }
          }
        }
      );
    }
  });
};

// Handle data sources
const startSimulation = dataSources => {
  switch (dataSources) {
    case "random":
      generateRandomData();
      break;
    case "database":
      readDataFromDatabase();
      break;
    default:
      console.error("[ERROR] Invalid data source : ", dataSources);
      cleanAndExit();
      break;
  }
};

// connect to mqtt broker
client.on("connect", () => {
  console.log(`[MQTT] Device ${devID} connected to MQTT broker`);
  startSimulation(process.argv[5]);
});

client.on("error", err => {
  console.error(`[ERROR] Device ${devID} cannot connect to MQTT broker: `, err);
});

client.on("offline", () => {
  console.log("[MQTT] MQTT client goes offline!");
});
