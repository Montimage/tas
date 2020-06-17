const DataRecorder = require('./DataRecorder');
const {
  readJSONFile
} = require("../utils");

const allDataRecorders = [];
/**
 * Stop recording data
 */
const stopRecording = () => {
  for (let index = 0; index < allDataRecorders.length; index++) {
    const dr = allDataRecorders[index];
    dr.stop();
  }
}

/**
 * Create a data recorder 
 * @param {Object} drConfig The configuration of a data recorder
 */
const createDataRecorder = (drConfig) => {
  const dr = new DataRecorder(drConfig);
  dr.initDataRecorder();
  allDataRecorders.push(dr);
};
/**
 * Start a list of data recorders
 * @param {Object} dataRecorders The configuration of data recorders
 */
const startRecording = (dataRecorders) => {
  while (allDataRecorders.length > 0) {
    allDataRecorders.pop();
  }

  for (let index = 0; index < dataRecorders.length; index++) {
    const {
      id,
      enable
    } = dataRecorders[index];
    if (enable === false) continue; // skip this data recorder
    createDataRecorder(dataRecorders[index]);
  }
};

if (process.argv[2] === "test") {
  readJSONFile(process.argv[3], (err, drConfig) => {
    if (err) {
      console.error(
        `[DataRecorder] [ERROR] Cannot read the config of data recorder:`,
        process.argv[3]
      );
      // console.error();
    } else {
      if (!drConfig.dataRecorders || drConfig.dataRecorders.length === 0) {
        console.error(
          `[DataRecorder] [ERROR] There is no data recorder:`,
          process.argv[3]
        );
      } else {
        startRecording(drConfig.dataRecorders);
      }
    }
  });
}

module.exports = {
  startRecording,
  stopRecording
};