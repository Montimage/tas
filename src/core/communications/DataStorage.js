const {
  ENACTDB,
  EventSchema,
  DatasetSchema,
  TestCampaignSchema,
  TestCaseSchema,
} = require('../enact-mongoose');
const ReportSchema = require('../enact-mongoose/schemas/ReportSchema');

/**
 * DataStorage class presents the interface of a data base
 * - supports different database type: MONGODB, couchDB, etc.
 * - provide 3 simple API
 *  + connect: to connect with the database
 *  + save(data): to save data
 *  + stop(): disconnect with the database
 */
class DataStorage {
  constructor(config, logger = null) {
    const { protocol, connConfig } = config;
    this.protocol = protocol;
    this.connConfig = connConfig;
    this.dsClient = null;
    // Where this connection writes its log lines. The run that opened the
    // connection passes its own logger in; without one, fall back to the
    // process console.
    this.logger = logger || console;
  }

  /**
   * Connect to the database
   * @param {Function} callback The callback function
   */
  connect(callback) {
    this.logger.log('[DataStorage] Connecting...');
    if (this.protocol === 'MONGODB') {
      const { host, port, username, password, dbname, options } = this.connConfig;
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
          // Name host, port and database only: these lines land in run log
          // files served by GET /api/logs/*/:fileName, so username and
          // password must never be included. (F-SEC-001, #72)
          this.logger.error(`[DataStorage] ERROR: Failed to connect to database:`, error, {
            host,
            port,
            dbname,
          });
          return callback(error);
        }
        this.logger.log('[DataStorage] Connected to database');
        return callback();
      });
    } else {
      this.logger.log(`Unsupported protocol: ${this.protocol}`);
    }
  }

  /**
   * Save data to database
   * @param {Object} data The data to be saved into the database
   */
  async saveEvent(data) {
    try {
      const rcData = new EventSchema(data);
      await rcData.save();
    } catch (err) {
      this.logger.error('[DataStorage] Cannot save event:', err);
    }
  }

  async saveDataset(dataset) {
    const currentTime = Date.now();
    try {
      const ds = await DatasetSchema.findOne({ id: dataset.id });
      if (ds) {
        await DatasetSchema.findByIdAndUpdate(ds._id, dataset);
      } else {
        const newDS = new DatasetSchema({
          ...dataset,
          createdAt: currentTime,
          lastModified: currentTime,
          source: dataset.source ? dataset.source : 'RECORDED',
        });
        await newDS.save();
        this.logger.log('[DataStorage] A new dataset has been created: ', dataset);
      }
    } catch (err) {
      this.logger.error(`[DataStorage] Cannot save dataset ${dataset.id}:`, err);
    }
  }

  async saveReport(report) {
    try {
      const rp = await ReportSchema.findOne({ id: report.id });
      if (rp) {
        this.logger.log('[DataStorage] Going to update a report: ', report);
        await ReportSchema.findOneAndUpdate({ id: report.id }, report);
      } else {
        this.logger.log('[DataStorage] Going to add a new report: ', report);
        const newReport = new ReportSchema(report);
        await newReport.save();
        this.logger.log('[DataStorage] A new report has been created');
      }
    } catch (err) {
      this.logger.error('[DataStorage] Cannot save report:', err);
    }
  }

  getAllEvents(datasetId, startTime, endTime, callback) {
    EventSchema.findEventsBetweenTimes(
      { datasetId },
      startTime ? startTime : 0,
      endTime ? endTime : Date.now()
    ).then(
      (events) => callback(null, events),
      (err) => {
        this.logger.error('[DataStorage] Cannot get events!', datasetId, err);
        return callback(err);
      }
    );
  }

  getEvents(topic, datasetId, timeConstraints, callback) {
    let { startTime, endTime } = timeConstraints;
    if (!startTime) startTime = 0;
    if (!endTime) endTime = Date.now();
    EventSchema.findEventsBetweenTimes({ topic, datasetId }, startTime, endTime).then(
      (events) => callback(null, events),
      (err) => {
        this.logger.error(
          '[DataStorage] Cannot get events!',
          topic,
          datasetId,
          timeConstraints,
          err
        );
        return callback(err);
      }
    );
  }

  async getTestCampaignById(testCampaignId, callback) {
    try {
      const tc = await TestCampaignSchema.findOne({ id: testCampaignId });
      if (!tc) {
        this.logger.error(
          `[DataStorage] Cannot get test campaign: ${testCampaignId}. TestCampaign is null`
        );
        return callback('Test Campaign is NULL', null);
      }
      return callback(null, tc);
    } catch (err) {
      this.logger.error(`[DataStorage] Cannot get test campaign: ${testCampaignId}`, err);
      return callback(err, null);
    }
  }

  async getTestCaseById(testCaseId, callback) {
    try {
      const tc = await TestCaseSchema.findOne({ id: testCaseId });
      if (!tc) {
        this.logger.error(`[DataStorage] Cannot get test Case: ${testCaseId}. TestCase is null`);
        return callback('Test Case is NULL', null);
      }
      return callback(null, tc);
    } catch (err) {
      this.logger.error(`[DataStorage] Cannot get test Case: ${testCaseId}`, err);
      return callback(err, null);
    }
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
