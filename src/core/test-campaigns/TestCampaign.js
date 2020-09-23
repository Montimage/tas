const DataStorage = require('../communications/DataStorage');
const {
  OFFLINE,
  SIMULATING
} = require('../DeviceStatus');
const TestCase = require('./TestCase');

class TestCampaign {
  constructor(id, dataStorageConfig, webhookURL) {
    this.id = id;
    this.name = id;
    this.dataStorageConfig = dataStorageConfig;
    this.dataStorage = new DataStorage(dataStorageConfig);
    this.webhookURL = webhookURL;
    //
    this.testCases = [];
    this.status = OFFLINE;
  }

  init(callback) {
    this.dataStorage.connect(() => {
      this.dataStorage.getTestCampaignById(this.id, (err, testCampaign) => {
        if (err) {
          return callback(err);
        } else {
          const {
            testCaseIds,
            name
          } = testCampaign;
          this.name = name ? name : this.id;
          for (let index = 0; index < testCaseIds.length; index++) {
            const tcaseId = testCaseIds[index];
            const testCase = new TestCase(tcaseId, this.dataStorageConfig, this.id);
            this.testCases.push(testCase);
          }
          return callback();
        }
      });
    });
  }

  start(callbackWhenFinish) {
    if (this.status === SIMULATING) {
      return callbackWhenFinish(`[TestCampaign] Test campaign is on running ${this.name}`);
    }

    if (!this.testCases || this.testCases.length === 0) {
      console.error(`[TestCampaign] No test case ${this.name}`);
      return callbackWhenFinish(`[TestCampaign] No test case ${this.name}`);
    }
    for (let index = 0; index < this.testCases.length; index++) {
      const testCase = this.testCases[index];
      testCase.init(() => {
        testCase.start(() => {
          console.log(`[TestCampaign] Finish test case ${testCase.name}`);
        });
      });
    }
    this.status = SIMULATING;
  }

  stop() {
    if (this.status === OFFLINE) {
      console.log(`[TestCampaign] Test Campaign is offline`);
      return;
    }

    for (let index = 0; index < this.testCases.length; index++) {
      const testCase = this.testCases[index];
      if (testCase.getStatus() !== OFFLINE) testCase.stop();
    }
    this.status = OFFLINE;
  }

  getStatus() {
    return this.status;
  }
}

module.exports = TestCampaign;