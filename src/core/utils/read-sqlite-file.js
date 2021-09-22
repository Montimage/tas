const {
  readTextFile
} = require('./index');
const {
  values
} = require('lodash');

/**
 * Question to be answers
 * - How many sensors
 * - Time of the data
 * - For each sensors
 *  + value
 *    - min
 *    - max
 *    - average
 *  + reportedTime
 *    - min
 *    - max
 *    - average
 */

class Sensor {
  constructor(id) {
    this.id = id;
    this.numberOfReports = 0;
    this.minValue = null;
    this.maxValue = null;
    this.averageValue = null;
    this.sumValue = 0;
    this.minReportTime = null;
    this.maxReportTime = null;
    this.averageReportTime = null;
    this.sumReportTime = 0;
    this.lastReportedTime = null;
  }
}

const filePath = process.argv[2];

const sensors = {};
const sensorIds = [];
let nbFailed = 0;
let startTime = null;
let endTime = null;
const processLineData = (line) => {
  if (line.indexOf('#') === 0) return;
  const array = line.split(' ');
  if (array.length < 3) {
    console.error('[ERROR] Invalid report: ', line);
    nbFailed++;
    return;
  }
  const sensorId = array[0];
  const timestamp = Number(array[2] / 1000000000); // in seconds
  if (startTime === null || startTime > timestamp) startTime = timestamp;
  if (endTime === null || endTime < timestamp) endTime = timestamp;
  let value = Math.round(100 * Number(array[1].replace('value=', '').trim())) / 100;
  if (isNaN(value)) {
    value = array[1].replace('value=', '').trim();
  }
  // array[0] -> id
  // array[0] -> value
  // array[0] -> timestamp
  if (!sensors[array[0]]) {
    const newSensor = new Sensor(sensorId);
    newSensor.numberOfReports++;
    if (typeof value === 'number') {
      newSensor.minValue = value;
      newSensor.maxValue = value;
      newSensor.sumValue = value;
    } else {
      newSensor.minValue = [value];
      newSensor.maxValue = [value];
      newSensor.sumValue = [value];
    }
    newSensor.lastReportedTime = timestamp;
    sensors[sensorId] = newSensor;
    sensorIds.push(sensorId);
  } else {
    const sensor = sensors[sensorId];
    sensor.numberOfReports++;
    if (typeof sensor.sumValue === 'number') {
      sensor.sumValue += value;
      if (sensor.maxValue < value) sensor.maxValue = value;
      if (sensor.minValue > value || !sensor.minValue) sensor.minValue = value;
    } else {
      sensor.sumValue.push(value);
      sensor.maxValue.push(value);
      sensor.minValue.push(value);
    }
    const reportedTime = Math.round(100 * (timestamp - sensor.lastReportedTime)) / 100;
    sensor.sumReportTime += reportedTime;
    if (sensor.maxReportTime < reportedTime) sensor.maxReportTime = reportedTime;
    if (sensor.minReportTime > reportedTime || !sensor.minReportTime) sensor.minReportTime = reportedTime;
    sensor.lastReportedTime = timestamp;
  }
}

const processFileData = (data) => {
  const array = data.split('\n');
  console.log('Number of messages: ', array.length);
  for (let index = 0; index < array.length; index++) {
    const line = array[index];
    processLineData(line);
  }
  for (let index = 0; index < sensorIds.length; index++) {
    const id = sensorIds[index];
    const sensor = sensors[id];
    if (sensor) {
      sensor.averageValue = Math.round(100 * sensor.sumValue / sensor.numberOfReports) / 100;
      sensor.averageReportTime = Math.round(100 * sensor.sumReportTime / sensor.numberOfReports) / 100;
    }
    if ( typeof sensor.sumValue === 'number') {
      console.log(`${sensor.id} ${sensor.numberOfReports} ${sensor.minReportTime} ${sensor.maxReportTime} ${sensor.averageReportTime} ${sensor.minValue} ${sensor.maxValue} ${sensor.averageValue} `);
    } else {
      console.log(`${sensor.id} ${sensor.numberOfReports} ${sensor.minReportTime} ${sensor.maxReportTime} ${sensor.averageReportTime} ${sensor.minValue.length}`);
    }
  }
  console.log('Number of messages: ', array.length);
  console.log('Total numer of items: ', sensorIds.length);
  const startTimeObject = new Date(startTime * 1000);
  console.log('Started time: ', startTimeObject.toLocaleTimeString(), startTimeObject.toLocaleDateString());
  const endTimeObject = new Date(endTime * 1000);
  console.log('End time: ', endTimeObject.toLocaleTimeString(), endTimeObject.toLocaleDateString());
};

readTextFile(filePath, (err, data) => {
  if (err) {
    console.error('Cannot read file', filePath, err);
  } else {
    processFileData(data);
  }
});