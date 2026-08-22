// The webhook notification uses the runtime's global fetch (Node >= 18);
// the node-fetch dependency is gone (issue #28).
const DataStorage = require('../communications/DataStorage');
const { OFFLINE, SIMULATING } = require('../DeviceStatus');
const TestCase = require('./TestCase');

class TestCampaign {
  constructor(id, dataStorageConfig, webhookURL, evaluationParameters, logger = null) {
    this.id = id;
    this.name = id;
    // Where this run writes its log lines. The route that started the
    // campaign passes its own logger in, shared by every test case and
    // simulation of the campaign; without one, fall back to the process
    // console.
    this.logger = logger || console;
    this.dataStorageConfig = dataStorageConfig;
    this.dataStorage = new DataStorage(dataStorageConfig, this.logger);
    this.webhookURL = webhookURL;
    this.evaluationParameters = evaluationParameters;
    //
    this.testCases = [];
    this.status = OFFLINE;
    this.results = [];
  }

  init(callback) {
    this.dataStorage.connect(() => {
      this.dataStorage.getTestCampaignById(this.id, (err, testCampaign) => {
        if (err) {
          return callback(err);
        } else {
          const { testCaseIds, name } = testCampaign;
          this.name = name ? name : this.id;
          for (let index = 0; index < testCaseIds.length; index++) {
            const tcaseId = testCaseIds[index];
            const testCase = new TestCase(
              tcaseId,
              this.dataStorageConfig,
              this.id,
              this.evaluationParameters,
              (scores = null) => {
                if (scores) {
                  this.results.push({
                    testCampaignId: this.id,
                    testCaseId: testCase.id,
                    scores,
                  });
                }

                for (let tcIndex = 0; tcIndex < this.testCases.length; tcIndex++) {
                  const tc = this.testCases[tcIndex];
                  if (tc.getStatus() !== OFFLINE) {
                    return;
                  }
                }
                this.logger.log('All test case have been finished');
                return this.stop();
              },
              this.logger
            );
            this.testCases.push(testCase);
          }
          return callback();
        }
      });
    });
  }

  sendResultToWebhook() {
    this.logger.log(`Going to notify the result to the webhook: ${this.webhookURL}`);
    fetch(this.webhookURL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(this.results),
    })
      .then((res) => {
        this.logger.log('Response from webhook:', res);
      })
      .catch((err) => {
        this.logger.error('Cannot send result to webhook', err);
      });
  }

  start() {
    if (this.status === SIMULATING) {
      this.logger.log(`[TestCampaign] Test campaign is on running ${this.name}`);
      return;
    }

    if (!this.testCases || this.testCases.length === 0) {
      this.logger.error(`[TestCampaign] No test case ${this.name}`);
      return this.stop();
    }
    for (let index = 0; index < this.testCases.length; index++) {
      const testCase = this.testCases[index];
      testCase.init(() => {
        testCase.start();
      });
    }
    this.status = SIMULATING;
  }

  stop() {
    if (this.status === OFFLINE) {
      this.logger.log(`[TestCampaign] Test Campaign is offline`);
      return;
    }

    for (let index = 0; index < this.testCases.length; index++) {
      const testCase = this.testCases[index];
      if (testCase.getStatus() !== OFFLINE) testCase.stop();
    }
    this.sendResultToWebhook();
    this.status = OFFLINE;
  }

  getStatus() {
    return this.status;
  }
}

module.exports = TestCampaign;
