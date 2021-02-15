const DataStorage = require("../communications/DataStorage");
const DRecorder = require("./DRecorder");
const { readJSONFile } = require("../utils");

class DataRecorder {
  constructor(drConfig) {
    const { dataStorage, dataRecorders, dataset } = drConfig;
    this.dataStorage = dataStorage;
    this.dataRecorders = dataRecorders;
    this.dataset = dataset;
    this.allDataRecorders = [];
  }

  /**
   *
   * @param {Object} dsConfig the configuration of the data storage
   * "dataStorage": {
        "protocol": "MONGODB",
        "connConfig": {
            "host": "localhost",
            "port": 27017,
            "username": null,
            "password": null,
            "dbname": "tasdb",
            "options": null
        },
        "dataset": {
            "id": "new-data-set",
            "name": "New Data Set",
            "description": "Dataset descriptions",
            "tags": ["recorded","random"]
        }
    }
   */
  /**
   * Initialise the Data storage
   * - Connect to the database
   * @param {Function} callback The callback function
   */
  initDataStorage(callback) {
    const dsClient = new DataStorage(this.dataStorage);
    dsClient.connect((error) => {
      if (error) {
        console.error("Failed to create DataStorage", error);
        return callback(error);
      } else {
        this.dataStorage["dsClient"] = dsClient;
        if (this.dataset) {
          dsClient.saveDataset(this.dataset);
          return callback();
        } else {
          console.error("Failed to create DataStorage: dataset missing");
          // TODO: check if there is resource leak
          // dsClient.stop();
          return callback("Dataset missing");
        }
      }
    });
  }

  initDRecorders() {
    for (let index = 0; index < this.dataRecorders.length; index++) {
      const dRecorderCfg = this.dataRecorders[index];
      const dRecorder = new DRecorder(dRecorderCfg, this.dataStorage, this.dataset);
      if (dRecorder.init()) {
        this.allDataRecorders.push(dRecorder);
      }
    }
  }

  /**
   * Initialize the data storage
   * - Connect to database
   * - Create the new dataset
   * - Init the data recorders
   */
  start() {
    console.log(`[DataRecorder] Going to start ...`);
    if (this.dataStorage) {
      this.initDataStorage(() => this.initDRecorders());
    } else {
      this.initDRecorders();
    }
  }

  stop() {
    console.log(`[DataRecorder] Going to stop ...`);
    // TODO: check if there is resource leak
    // if (this.dataStorage && this.dataStorage.dsClient) {
    //   this.dataStorage.dsClient.stop();
    // }

    while(this.allDataRecorders.length > 0) {
      const dRecorder = this.allDataRecorders.pop();
      dRecorder.stop();
    }
  }
}

if (process.argv[2] === "test") {
  readJSONFile(process.argv[3], (err, drConfig) => {
    if (err) {
      console.error(
        `[DataRecorder] [ERROR] Cannot read the config of data recorder:`,
        process.argv[3]
      );
      // console.error();
    } else {
      const dataRecorder = new DataRecorder(drConfig);
      dataRecorder.start();
    }
  });
}

module.exports = DataRecorder;
