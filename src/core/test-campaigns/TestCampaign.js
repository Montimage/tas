const fetch = require("node-fetch");
const DataStorage = require("../communications/DataStorage");
const { OFFLINE, SIMULATING } = require("../DeviceStatus");
const TestCase = require("./TestCase");

class TestCampaign {
  constructor(id, dataStorageConfig, webhookURL, evaluationParameters) {
    this.id = id;
    this.name = id;
    this.dataStorageConfig = dataStorageConfig;
    this.dataStorage = new DataStorage(dataStorageConfig);
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
          const totalNumberTestCases = testCaseIds.length;
          for (let index = 0; index < testCaseIds.length; index++) {
            const tcaseId = testCaseIds[index];
            const testCase = new TestCase(
              tcaseId,
              this.dataStorageConfig,
              this.id,
              this.evaluationParameters,
              (scores = null) => {
                // When a test case finish - check if this is the last test case
                if (scores) {
                  this.results.push({
                    testCampaignId: this.id,
                    testCaseId: testCase.id,
                    scores,
                  });
                }
                if (index === totalNumberTestCases - 1) {
                  // This is the last test case
                  console.log("All test case have been finished");
                  return this.stop();
                } else {
                  const nextTestCase = this.testCases[index+1];
                  nextTestCase.start();
                }
                // for (
                //   let tcIndex = 0;
                //   tcIndex < this.testCases.length;
                //   tcIndex++
                // ) {
                //   const tc = this.testCases[tcIndex];
                //   if (tc.getStatus() !== OFFLINE) {
                //     return;
                //   }
                // }
                // console.log("All test case have been finished");
                // return this.stop();
              }
            );
            this.testCases.push(testCase);
          }
          return callback();
        }
      });
    });
  }

  sendResultToWebhook() {
    console.log(
      `Going to notify the result to the webhook: ${this.webhookURL}`
    );
    fetch(this.webhookURL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(this.results),
    })
      .then((res) => {
        console.log("Response from webhook:");
        console.log(JSON.stringify(res));
      })
      .catch((err) => {
        console.error("Cannot send result to webhook");
        console.log(JSON.stringify(err));
      });
  }

  start() {
    if (this.status === SIMULATING) {
      console.log(`[TestCampaign] Test campaign is on running ${this.name}`);
      return;
    }

    if (!this.testCases || this.testCases.length === 0) {
      console.error(`[TestCampaign] No test case ${this.name}`);
      return this.stop();
    }
    console.log(`[TestCampaign-${this.id}] is starting...`);
    for (let index = 0; index < this.testCases.length; index++) {
      const testCase = this.testCases[index];
      testCase.init(() => {
        console.log(`[TestCase-${testCase.id}] is ready!!!`);
        if (index === 0) testCase.start();
      });
    }
    // if(this.testCases.length > 0) this.testCases[0].start();
    this.status = SIMULATING;
  }

  stop() {
    console.log(`[TestCampaign-${this.id}] is stopping...`);
    if (this.status === OFFLINE) {
      console.log(`[TestCampaign] Test Campaign is offline`);
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
