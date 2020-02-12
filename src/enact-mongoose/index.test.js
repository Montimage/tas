const { ENACTDB, Sensor } = require("../enact-mongoose");
const config = require("../config");

console.log(
  `Read data from database ${config.DB_HOST}:${config.DB_PORT}/${config.DB_NAME}`
);
let enactDB = null;
if (config.DB_USER && config.DB_PASSWORD) {
  enactDB = new ENACTDB(config.DB_HOST, config.DB_PORT, config.DB_NAME, {
    userName: config.DB_USER,
    password: config.DB_PASSWORD
  });
} else {
  enactDB = new ENACTDB(config.DB_HOST, config.DB_PORT, config.DB_NAME);
}

// Testing function
const startTesting = () => {
  const startTime = process.argv[2];
  const endTime = process.argv[3] ? process.argv[3] : Date.now();
  Sensor.findSensorsWithOptions(
    { sensorID: "sensor-01" },
    // startTime,
    // endTime,
    (err, listData) => {
      if (err) {
        console.log(err);
      } else {
        console.log("listData: ", listData.length);
      }
      enactDB.close();
    }
  );
};

// START TESTING
enactDB.connect(() => {
  console.log("Connected to database");
  startTesting();
});
