const childProcess = require('child_process');

const showHelp = () => {
  console.log(`
  Usage:
    node scale.js <sensor-prefix> <sensor-start-index> <number-sensors> <mqtt-broker-address> <data-define> <time-interval>
  Options:
    sensor-prefix    the prefix of the sensor id
    sensor-start-index      the index to start (first sensor's id)
    mqtt-broker-address   The address of mqtt-broker server
    data-define: a json file to defined the type of data
    time-interval: time period to generate data
  `);
}

// Parse arguments
if (process.argv.length < 8) {
  console.error('Missing argument!');
  showHelp();
}

const sensorPrefix = process.argv[2];
const sensorStartIndex = Number(process.argv[3]);
const numberSensors = Number(process.argv[4]);
const mqttBrokerAddress = process.argv[5];
const dataDescription = process.argv[6];
const timeInterval = process.argv[7];

for (let index = sensorStartIndex; index < sensorStartIndex + numberSensors; index++) {
  const sensorId = `${sensorPrefix}${index}`;
  const simulatorProcess = childProcess.fork(`${__dirname}/index.js`, ['sensor', sensorId, mqttBrokerAddress, 'random', dataDescription, timeInterval]);
  simulatorProcess.on('error', (err)=>{
    console.error(`[ERROR] Error in simulating ${sensorId}`);
    console.log(err);
  });
}