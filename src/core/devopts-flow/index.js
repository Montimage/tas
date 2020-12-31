const { readJSONFile } = require("../utils");
const TestCampaign = require("../test-campaigns/TestCampaign");

let testCampaign = null;

const getTestCampainStatus = () => {
  if (testCampaign) return testCampaign.status;
  else return null;
}

/**
 * Stop the test campaign
 */
const stopTestCampaign = () => {
  testCampaign.stop();
};

/**
 * Start the test campaign
 * @param {Object} model The model to be simulated
 */
const startTestCampaign = (testCampaignId, dataStorage, webhookURL) => {
  console.log('Start test campaign: ', testCampaignId, dataStorage, webhookURL);
  testCampaign = new TestCampaign(testCampaignId, dataStorage, webhookURL);
  testCampaign.init((err) => {
    if (err) {
      console.log(`[devopts-flow] Failed to start a Test Campaign ${testCampaignId}`);
    } else {
      testCampaign.start(() => {
        console.log(`[devopts-flow] Test campaign ${testCampaignId} has been finished`);
      });
    }
  });
};

if (process.argv[2] === "test") {
  readJSONFile(process.argv[3], (err, devopts) => {
    if (err) {
      console.error(
        `[devopts-flow] [ERROR] Cannot read the config of devopts flow:`,
        process.argv[3]
      );
      // console.error();
    } else {
      if (!devopts) {
        console.error(
          `[devopts-flow] [ERROR] There is no devopts object:`,
          process.argv[3]
        );
      } else {
        const {testCampaignId, dataStorage, webhookURL} = devopts;
        if (!testCampaignId || !dataStorage) {
          console.error('[devopts-flow] Cannot start test campaign: ', testCampaignId, dataStorage);
        } else {
          startTestCampaign(testCampaignId, dataStorage, webhookURL);
        }
      }
    }
  });
}

module.exports = {
  startTestCampaign,
  stopTestCampaign,
  getTestCampainStatus
};
