const {
  ENACTDB,
  EventSchema,
  DataSetSchema
} = require('../enact-mongoose');
const TestCampaignSchema = require('../enact-mongoose/schemas/TestCampaignSchema');
const TestCaseSchema = require('../enact-mongoose/schemas/TestCaseSchema');

/**
 * DataStorage class presents the interface of a data base
 * - supports different database type: MONGODB, couchDB, etc.
 * - provide 3 simple API
 *  + connect: to connect with the database
 *  + save(data): to save data
 *  + stop(): disconnect with the database
 */
class DataStorage {
  constructor(config) {
    const {
      protocol,
      connConfig
    } = config;
    this.protocol = protocol;
    this.connConfig = connConfig;
    this.dsClient = null;
  }

  /**
   * Connect to the database
   * @param {Function} callback The callback function
   */
  connect(callback) {
    console.log('[DataStorage] Connecting...');
    if (this.protocol === 'MONGODB') {
      const {
        host,
        port,
        user,
        password,
        dbname,
        options
      } = this.connConfig;
      if (user && password) {
        this.dsClient = new ENACTDB(
          host,
          port,
          dbname, {
            userName: user,
            password: password,
          }
        );
      } else {
        this.dsClient = new ENACTDB(host, port, dbname);
      }

      this.dsClient.connect((error) => {
        if (error) {
          console.error(
            "[DataStorage] ERROR: Failed to connect to database",
            error,
            dbConfig
          );
          return callback(error);
        }
        console.log("[DataStorage] Connected to database");
        return callback();
      });
    }
  }

  /**
   * Save data to database
   * @param {Object} data The data to be saved into the database
   */
  saveEvent(data) {
    const rcData = new EventSchema(data);
    rcData.save();
  }

  saveDataSet(dataset) {
    const currentTime = Date.now();
    DataSetSchema.findOne({id: dataset.id}, (err, ds) => {
      if (ds) {
        DataSetSchema.findByIdAndUpdate(ds._id, dataset);
      } else {
        const newDS = new DataSetSchema({...dataset, createdAt: currentTime, createdAt: currentTime});
        newDS.save();
      }
    });
    
  }

  getEvents(topic, datasetId, timeConstraints, callback) {
    let {startTime, endTime } = timeConstraints; 
    if (!startTime) startTime = 0;
    if (!endTime) endTime = Date.now();
    EventSchema.findEventsBetweenTimes({topic, datasetId}, startTime, endTime, (err, events) => {
      if (err) {
        console.error('[DataStorage] Cannot get events!', topic, datasetId, timeConstraints, err);
        return callback(err);
      } else {
        return callback(null, events);
      }
    });
  }

  getTestCampaignById(testCampaignId, callback) {
    TestCampaignSchema.findOne({id: testCampaignId}, (err, tc) => {
      if (err) {
        console.error(`[DataStorage] Cannot get test campaign: ${testCampaignId}`, err);
        return callback(err, null);
      } else if (!tc) {
        console.error(`[DataStorage] Cannot get test campaign: ${testCampaignId}. TestCampaign is null`);
        return callback("Test Campaign is NULL", null);
      } else {
        return callback(null, tc);
      }
    });
  }

  getTestCaseById(testCaseId, callback) {
    TestCaseSchema.findOne({id: testCaseId}, (err, tc) => {
      if (err) {
        console.error(`[DataStorage] Cannot get test Case: ${testCaseId}`, err);
        return callback(err, null);
      } else if (!tc) {
        console.error(`[DataStorage] Cannot get test Case: ${testCaseId}. TestCase is null`);
        return callback("Test Case is NULL", null);
      } else {
        return callback(null, tc);
      }
    });
  }
  /**
   * Disconnect with the database
   */
  stop() {
    if (this.dsClient) {
      this.dsClient.close();
    }
  }
}

module.exports = DataStorage;