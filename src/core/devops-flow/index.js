const { readJSONFile } = require('../utils');
const TestCampaign = require('../test-campaigns/TestCampaign');

let testCampaign = null;

const getTestCampainStatus = () => {
  if (testCampaign) return testCampaign.status;
  else return null;
};

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
const startTestCampaign = (
  testCampaignId,
  dataStorage,
  webhookURL,
  evaluationParameters,
  logger = null
) => {
  // The run's own logger, obtained explicitly by the caller. Without one,
  // fall back to the process console.
  const log = logger || console;
  // console.log("Start test campaign: ");
  // console.log(testCampaignId);
  // console.log(JSON.stringify(dataStorage));
  // console.log(webhookURL);
  // console.log(JSON.stringify(evaluationParameters));
  testCampaign = new TestCampaign(
    testCampaignId,
    dataStorage,
    webhookURL,
    evaluationParameters,
    logger
  );
  testCampaign.init((err) => {
    if (err) {
      log.log(`[devops-flow] Failed to start a Test Campaign ${testCampaignId}`);
    } else {
      testCampaign.start(() => {
        log.log(`[devops-flow] Test campaign ${testCampaignId} has been finished`);
      });
    }
  });
};

if (process.argv[2] === 'test') {
  readJSONFile(process.argv[3], (err, devops) => {
    if (err) {
      console.error(
        `[devops-flow] [ERROR] Cannot read the config of devops flow:`,
        process.argv[3]
      );
      // console.error();
    } else {
      if (!devops) {
        console.error(`[devops-flow] [ERROR] There is no devops object:`, process.argv[3]);
      } else {
        const { testCampaignId, dataStorage, webhookURL, evaluationParameters } = devops;
        if (!testCampaignId || !dataStorage) {
          console.error('[devops-flow] Cannot start test campaign: ', testCampaignId, dataStorage);
        } else {
          startTestCampaign(testCampaignId, dataStorage, webhookURL, evaluationParameters);
        }
      }
    }
  });
}

module.exports = {
  startTestCampaign,
  stopTestCampaign,
  getTestCampainStatus,
};
