const {
  ENACTDB,
  EventSchema,
  DatasetSchema,
  TestCampaignSchema,
  TestCaseSchema,
} = require("../enact-mongoose");
const ReportSchema = require("../enact-mongoose/schemas/ReportSchema");

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
    const { protocol, connConfig } = config;
    this.protocol = protocol;
    this.connConfig = connConfig;
    this.dsClient = null;
  }

  /**
   * Connect to the database
   * @param {Function} callback The callback function
   */
  connect(callback) {
    console.log("[DataStorage] Connecting...");
    if (this.protocol === "MONGODB") {
      const {
        host,
        port,
        username,
        password,
        dbname,
        options,
      } = this.connConfig;
      if (username && password) {
        this.dsClient = new ENACTDB(host, port, dbname, {
          username: username,
          password: password,
        });
      } else {
        this.dsClient = new ENACTDB(host, port, dbname);
      }

      this.dsClient.connect((error) => {
        if (error) {
          console.error(`[DataStorage] ERROR: Failed to connect to database:`);
          console.error(error);
          console.error(this.connConfig);
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

  saveDataset(dataset) {
    const currentTime = Date.now();
    DatasetSchema.findOne({ id: dataset.id }, (err, ds) => {
      if (ds) {
        DatasetSchema.findByIdAndUpdate(ds._id, dataset);
      } else {
        const newDS = new DatasetSchema({
          ...dataset,
          createdAt: currentTime,
          lastModified: currentTime,
          source: dataset.source ? dataset.source : "RECORDED",
        });
        newDS.save();
        console.log("[DataStorage] A new dataset has been created: ", dataset);
      }
    });
  }

  saveReport(report) {
    ReportSchema.findOne({ id: report.id }, (err, rp) => {
      if (rp) {
        console.log("[DataStorage] Going to update a report: ");
        console.log(report);
        ReportSchema.findOneAndUpdate({ id: report.id }, report);
      } else {
        console.log("[DataStorage] Going to add a new report: ");
        console.log(report);
        const newReport = new ReportSchema(report);
        newReport.save();
        console.log("[DataStorage] A new report has been created");
      }
    });
  }

  getFirstEventTimestamp(
    datasetId,
    startTime = 0,
    endTime = Data.now(),
    callback
  ) {
    EventSchema.findEventsBetweenTimes(
      { datasetId },
      startTime,
      endTime,
      (err, events) => {
        if (err || !events || events.length === 0) {
          console.error("[DataStorage] Cannot get events!");
          console.error(err);
          return callback(err);
        } else {
          return callback(null, events[0].timestamp);
        }
      }
    );
  }

  getEvents(topic, datasetId, timeConstraints, callback) {
    let { startTime, endTime } = timeConstraints;
    if (!startTime) startTime = 0;
    if (!endTime) endTime = Date.now();
    EventSchema.findEventsBetweenTimes(
      { topic, datasetId },
      startTime,
      endTime,
      (err, events) => {
        if (err) {
          console.error(
            "[DataStorage] Cannot get events!",
            topic,
            datasetId,
            timeConstraints,
            err
          );
          return callback(err);
        } else {
          return callback(null, events);
        }
      }
    );
  }

  getTestCampaignById(testCampaignId, callback) {
    TestCampaignSchema.findOne({ id: testCampaignId }, (err, tc) => {
      if (err) {
        console.error(
          `[DataStorage] Cannot get test campaign: ${testCampaignId}`,
          err
        );
        return callback(err, null);
      } else if (!tc) {
        console.error(
          `[DataStorage] Cannot get test campaign: ${testCampaignId}. TestCampaign is null`
        );
        return callback("Test Campaign is NULL", null);
      } else {
        return callback(null, tc);
      }
    });
  }

  getTestCaseById(testCaseId, callback) {
    TestCaseSchema.findOne({ id: testCaseId }, (err, tc) => {
      if (err) {
        console.error(`[DataStorage] Cannot get test Case: ${testCaseId}`, err);
        return callback(err, null);
      } else if (!tc) {
        console.error(
          `[DataStorage] Cannot get test Case: ${testCaseId}. TestCase is null`
        );
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
