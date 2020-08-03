const DataStorage = require('../communications/DataStorage');
const {OFFLINE, SIMULATING} = require('../DeviceStatus');
const Simulation = require('../simulation');
const { readJSONFileSync, readJSONFile } = require('../utils');

class TestCase {
  constructor(id, dataStorageConfig) {
    this.id = id;
    this.name = id;
    this.dataStorageConfig = dataStorageConfig;
    this.dataStorage = new DataStorage(dataStorageConfig);
    this.simulations = [];
    this.modelFilePath = null;
    this.model = null;
    this.datasetIds = null;
    this.status = OFFLINE;
  }

  init(callback) {
    this.dataStorage.connect((err) => {
      if (err) {
        console.error(`[TestCase] Cannot connect to data storage: ${JSON.stringify(err)}`);
        return callback(err);
      }
      this.dataStorage.getTestCaseById(this.id, (err, tc) => {
        if (err) {
          console.error(`[TestCase] Cannot get the test case by id: ${this.id}`);
          return callback(err);
        }
        const {datasetIds, name, modelFilePath} = tc;
        this.name = name ? name : this.id;
        this.modelFilePath = modelFilePath;
        if (!datasetIds || datasetIds.length === 0) {
          console.error(`[TestCase] No datasetIds: ${this.id}`);
          return callback(`[TestCase] No datasetIds: ${this.id}`);
        }
        if (!this.modelFilePath) {
          return callback(`[TestCase] No modelFilePath: ${this.name}`);
        }
        this.datasetIds = datasetIds;
        this.modelFilePath = modelFilePath;
        // TODO: load model from file
        return readJSONFile(this.modelFilePath, (err2, data) => {
          if (err2) {
            console.error(`[TestCase] Cannot read model file ${this.modelFilePath}`);
            return callback(`Cannot read model file ${this.modelFilePath}`);
          } else {
            this.model = data;
            return callback(null);
          }
        });
      });
    });
  }

  start(callbackWhenFinish) {
    if (this.status === SIMULATING) {
      return callbackWhenFinish('[TestCase] Test case is in simulating');
    }
    if (!this.datasetIds || this.datasetIds.length === 0) {
      return callbackWhenFinish('[TestCase] No datasetIds');
    }
    if (!this.model) {
      return callbackWhenFinish('[TestCase] No model');
    }
    for (let index = 0; index < this.datasetIds.length; index++) {
      const datasetId = this.datasetIds[index];
      const newSimulation = new Simulation(this.model,{dataStorage: this.dataStorageConfig, datasetId} );
      newSimulation.start();
      this.simulations.push(newSimulation);
    }
    this.status = SIMULATING;
  }

  stop() {
    if (this.status === OFFLINE) {
      console.log(`[TestCase] Test case ${this.name} is offline`);
    } else {
      for (let index = 0; index < this.simulations.length; index++) {
        const simulation = this.simulations[index];
        simulation.stop();
      }
    }
  }

  getStatus() {
    return this.status;
  }

}

module.exports = TestCase;