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
 * @returns {TestCampaign} The campaign that was started. The caller - the
 *   devops route, through the runtime registry (#29) - holds this instance so
 *   it can be stopped again; the module-level variable below only remains for
 *   the standalone CLI entry point at the bottom of this file.
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
  return testCampaign;
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
