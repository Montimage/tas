const DataStorage = require('../communications/DataStorage');
const {OFFLINE, SIMULATING} = require('../DeviceStatus');
const Simulation = require('../simulation');
const { readJSONFile } = require('../utils');
const modelsPath = `${__dirname}/../../server/data/models/`;
class TestCase {
  constructor(id, dataStorageConfig, testCampaignId = null, evaluationParameters = null,callbackWhenFinish = null) {
    this.id = id;
    this.name = id;
    this.dataStorageConfig = dataStorageConfig;
    this.dataStorage = new DataStorage(dataStorageConfig);
    this.simulations = [];
    this.modelFileName = null;
    this.model = null;
    this.datasetIds = null;
    this.status = OFFLINE;
    this.testCampaignId = testCampaignId;
    this.scores = [];
    this.callbackWhenFinish = callbackWhenFinish;
    this.evaluationParameters = evaluationParameters;
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
        const {datasetIds, name, modelFileName} = tc;
        this.name = name ? name : this.id;
        this.modelFileName = modelFileName;
        if (!datasetIds || datasetIds.length === 0) {
          console.error(`[TestCase] No datasetIds: ${this.id}`);
          return callback(`[TestCase] No datasetIds: ${this.id}`);
        }
        if (!this.modelFileName) {
          return callback(`[TestCase] No modelFileName: ${this.name}`);
        }
        this.datasetIds = datasetIds;
        this.modelFileName = modelFileName;
        return readJSONFile(`${modelsPath}${this.modelFileName}`, (err2, data) => {
          if (err2) {
            console.error(`[TestCase] Cannot read model file ${this.modelFileName}`);
            console.error(err2)
            return callback(`Cannot read model file ${this.modelFileName}`);
          } else {
            this.model = data;
            return callback(null);
          }
        });
      });
    });
  }

  start() {
    if (this.status === SIMULATING) {
      console.log('[TestCase] Test case is in simulating');
      return;
    }
    if (!this.datasetIds || this.datasetIds.length === 0) {
      console.log('[TestCase] No datasetIds');
      this.stop();
      return;
    }
    if (!this.model) {
      console.log('[TestCase] No model');
      this.stop();
      return;
    }
    for (let index = 0; index < this.datasetIds.length; index++) {
      const datasetId = this.datasetIds[index];
      const stopTestCase = () => this.stop();
      const newSimulation = new Simulation(this.model,{dataStorage: this.dataStorageConfig, datasetId, testCampaignId: this.testCampaignId, evaluationParameters: this.evaluationParameters}, (score = null) => {
        if (score !== null && score !== undefined) {
          // Do something if the score === 0
          this.scores.push({
            simulationIndex: index,
            datasetId,
            score
          });
        }
        for (let simuIndex = 0; simuIndex < this.simulations.length; simuIndex++) {
          const sim = this.simulations[simuIndex];
          if (sim.status !== OFFLINE) {
            return;
          }
          // All the simulations have been finished
          stopTestCase();
          return;
        }
      });
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
      this.status = OFFLINE;
      if (this.callbackWhenFinish) this.callbackWhenFinish(this.scores);
    }
  }

  getStatus() {
    return this.status;
  }

}

module.exports = TestCase;