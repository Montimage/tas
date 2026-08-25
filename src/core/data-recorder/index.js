const DataStorage = require('../communications/DataStorage');
const DRecorder = require('./DRecorder');
const { readJSONFile } = require('../utils');

class DataRecorder {
  constructor(drConfig, logger = null) {
    const { dataStorage, dataRecorders, dataset } = drConfig;
    // The caller's objects are never written to: the connected client used to
    // be attached straight onto this configuration object, which is the very
    // object the start route echoes back in its response - serialising a live
    // client (open sockets, timer handles) crashed JSON.stringify and took
    // the whole server down (issue #33). The client lives on `this` instead,
    // and each recorder receives a private copy with the client attached.
    this.dataStorageConfig = dataStorage;
    this.dsClient = dataStorage && dataStorage.dsClient ? dataStorage.dsClient : null;
    this.dataRecorders = dataRecorders;
    this.dataset = dataset;
    this.allDataRecorders = [];
    // Where this run writes its log lines. The route that started the
    // recorder passes its own logger in; without one, fall back to the
    // process console.
    this.logger = logger || console;
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
    const dsClient = new DataStorage(this.dataStorageConfig, this.logger);
    dsClient.connect((error) => {
      if (error) {
        this.logger.error('Failed to create DataStorage', error);
        return callback(error);
      } else {
        this.dsClient = dsClient;
        if (this.dataset) {
          dsClient.saveDataset(this.dataset);
          return callback();
        } else {
          this.logger.error('Failed to create DataStorage: dataset missing');
          dsClient.stop();
          return callback('Dataset missing');
        }
      }
    });
  }

  initDRecorders() {
    for (let index = 0; index < this.dataRecorders.length; index++) {
      const dRecorderCfg = this.dataRecorders[index];
      // A per-recorder copy carries the live client: `DRecorder` reads it
      // from its data-storage argument, and the copy keeps the shared
      // configuration - and whatever the caller passed in - unpolluted.
      const recorderStorage =
        this.dsClient && this.dataStorageConfig
          ? { ...this.dataStorageConfig, dsClient: this.dsClient }
          : this.dataStorageConfig;
      const dRecorder = new DRecorder(dRecorderCfg, recorderStorage, this.dataset, this.logger);
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
    this.logger.log(`[DataRecorder] Going to start ...`);
    if (this.dataStorageConfig) {
      this.initDataStorage(() => this.initDRecorders());
    } else {
      this.initDRecorders();
    }
  }

  stop() {
    this.logger.log(`[DataRecorder] Going to stop ...`);
    if (this.dsClient) {
      this.dsClient.stop();
    }

    while (this.allDataRecorders.length > 0) {
      const dRecorder = this.allDataRecorders.pop();
      dRecorder.stop();
    }
  }
}

if (process.argv[2] === 'test') {
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
