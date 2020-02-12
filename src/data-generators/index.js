const { ENACTDB, Actuator, Sensor } = require("../enact-mongoose");
const DataGenerator = require("./DataGenerator");
const config = require("../config");

const showHelp = () => {
  console.log(`Usage:
    node index.js <dev-type> <dev-id> <data-source>
  Options:
    dev-type    Device type. Can be "sensor" or "actuator"
    dev-id      Device id
    data-sources    the source of the data:
      random <data-define> <time-interval> [<start-time> [duration]]: randomly generates regular data based on the data-define
        data-define: a json file to defined the type of data
        time-interval: time period to generate data
        start-time: time to start. Current time if NULL
        duration: duration time to generate data -> infinitite if NULL
  `);
};

const invalidArgument = errorMessage => {
  console.error(`[ERROR] cannot start data generator. ${errorMessage}`);
  showHelp();
  process.exit(1);
};

// Parse the command-line parameters
const devType = process.argv[2];
if (devType === "help") {
  showHelp();
  process.exit(0);
} else if (devType !== "sensor" && devType !== "actuator") {
  invalidArgument("Invalid dev-type value!");
}

if (process.argv.length < 5) {
  invalidArgument("Missing argument!");
}

// Clean and exit the simulation
const cleanAndExit = () => {
  if (enactDB) {
    setTimeout(() => {
      enactDB.close();
    }, 3000);
  }
};

// Parse first arguments
const devID = process.argv[3];

let enactDB = null;
if (config.DB_USER && config.DB_PASSWORD) {
  enactDB = new ENACTDB(config.DB_HOST, config.DB_PORT, config.DB_NAME, {
    userName: config.DB_USER,
    password: config.DB_PASSWORD
  });
} else {
  enactDB = new ENACTDB(config.DB_HOST, config.DB_PORT, config.DB_NAME);
}

const saveData = (data, generatedTime) => {
  if (devType == "actuator") {
    const newActuator = new Actuator({
      timestamp: generatedTime,
      actID: devID,
      value: JSON.stringify(data)
    });
    newActuator.save();
  } else if (devType == "sensor") {
    const newSensor = new Sensor({
      timestamp: generatedTime,
      sensorID: devID,
      value: JSON.stringify(data)
    });
    newSensor.save();
  }
};

// Generate data randomly
const generateRandomData = () => {
  if (process.argv.length < 7) {
    cleanAndExit();
    invalidArgument("Missing argument!");
  }
  const dataDescription = JSON.parse(process.argv[5]);
  const timeInterval = Number(process.argv[6]);

  const dataGenerator = new DataGenerator(dataDescription);
  let startTime = Number(process.argv[7]);
  let timeDelta = 0;
  const timePeriod = Number(process.argv[8]);
  if (!startTime) {
    startTime = Date.now();
  } else {
    timeDelta = Date.now() - startTime;
  }
  console.log(
    `Generate randomly data ${dataDescription.type} and publish the data in every ${timeInterval} seconds`
  );
  console.log(
    `Start Time ${startTime} and duration time ${timePeriod} seconds`
  );
  let generatorID = setInterval(() => {
    dataGenerator.generateData(data => {
      const generatedTime = Date.now() - timeDelta;
      saveData(data, generatedTime);
      if (timePeriod && generatedTime - startTime > timePeriod * 1000) {
        console.log("Finish!");
        clearInterval(generatorID);
        cleanAndExit();
      }
    });
  }, timeInterval * 1000);
};

// Handle data sources
const startGeneratingData = dataSources => {
  switch (dataSources) {
    case "random":
      generateRandomData();
      break;
    default:
      console.error("[ERROR] Invalid data source : ", dataSources);
      cleanAndExit();
      break;
  }
};

enactDB.connect(error => {
  if (error) {
    console.log("[ERROR] Failed to connect to database", error);
    exit(1);
  }
  console.log("Connected to database");
  startGeneratingData(process.argv[4]);
});
