const {
  ENACTDB,
  EventSchema,
  DatasetSchema,
  TestCampaignSchema,
  TestCaseSchema,
} = require('../enact-mongoose');
const ReportSchema = require('../enact-mongoose/schemas/ReportSchema');

// Event-write batching (issue #31). The data path used to open one document
// save per message, so a high-rate simulation paid a full round trip per
// event and any failure was logged and forgotten. Writes now queue and flush
// as one `insertMany` when either trigger fires: the queue reaches
// DEFAULT_EVENT_BATCH_SIZE documents, or DEFAULT_EVENT_FLUSH_INTERVAL_MS
// passes since the timer was armed. A failed batch is retried before it is
// given up on, and a batch that still fails is counted and reported - it is
// never dropped silently.
const DEFAULT_EVENT_BATCH_SIZE = 50;
const DEFAULT_EVENT_FLUSH_INTERVAL_MS = 200;
const DEFAULT_EVENT_WRITE_RETRIES = 2;

/**
 * DataStorage class presents the interface of a data base
 * - supports different database type: MONGODB, couchDB, etc.
 * - provide 3 simple API
 *  + connect: to connect with the database
 *  + save(data): to save data
 *  + stop(): disconnect with the database
 */
class DataStorage {
  constructor(config, logger = null, eventWriteOptions = {}) {
    const { protocol, connConfig } = config;
    this.protocol = protocol;
    this.connConfig = connConfig;
    this.dsClient = null;
    // Where this connection writes its log lines. The run that opened the
    // connection passes its own logger in; without one, fall back to the
    // process console.
    this.logger = logger || console;
    // Batched-write tuning (issue #31); the defaults above serve the
    // simulation paths, tests shrink them to make the triggers observable.
    const options = eventWriteOptions || {};
    this.eventBatchSize = options.maxBatchSize || DEFAULT_EVENT_BATCH_SIZE;
    this.eventFlushIntervalMs =
      options.flushIntervalMs !== undefined
        ? options.flushIntervalMs
        : DEFAULT_EVENT_FLUSH_INTERVAL_MS;
    this.eventWriteRetries =
      options.writeRetries !== undefined ? options.writeRetries : DEFAULT_EVENT_WRITE_RETRIES;
    this.onEventsDropped = typeof options.onDrop === 'function' ? options.onDrop : null;
    // Queue state. `eventFlushChain` serialises flushes so two triggers
    // firing together cannot interleave two insertMany batches.
    this.pendingEvents = [];
    this.eventFlushTimer = null;
    this.eventFlushChain = null;
    // Write statistics: how many events were persisted, how many were given
    // up on after their retries ran out.
    this.savedEventCount = 0;
    this.droppedEventCount = 0;
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
   * Queue one event for the next batched write (issue #31).
   *
   * The queue flushes as one `insertMany` when the size trigger fires (the
   * queue reached `eventBatchSize` documents) or the time trigger fires
   * (`eventFlushIntervalMs` since the timer was armed), whichever comes
   * first.
   * @param {Object} data The event to be saved into the database
   */
  async saveEvent(data) {
    // The pre-batching saveEvent never rejected: its try/catch turned every
    // failure into a logged line, and its callers (the message hot path)
    // still fire-and-forget without a catch - an escaping rejection here
    // would take the process down as an unhandled rejection.
    let event;
    try {
      event = new EventSchema(data);
    } catch (err) {
      this.logger.error('[DataStorage] Cannot queue event:', err);
      return;
    }
    this.pendingEvents.push(event);
    if (this.pendingEvents.length >= this.eventBatchSize) {
      this.flushEvents();
    } else {
      this.scheduleEventFlush();
    }
  }

  /**
   * Arm the time trigger for the current queue, unless one is already armed.
   */
  scheduleEventFlush() {
    if (this.eventFlushTimer) return;
    const timer = setTimeout(() => {
      this.eventFlushTimer = null;
      this.flushEvents();
    }, this.eventFlushIntervalMs);
    // Never hold the process open for a pending batch: shutdown goes through
    // `stop()`, which drains the queue explicitly.
    if (typeof timer.unref === 'function') timer.unref();
    this.eventFlushTimer = timer;
  }

  /**
   * Write every queued event down. Concurrent calls share one drain: the
   * first starts it and the rest await the same chain, so two triggers
   * firing together cannot interleave two insertMany batches.
   * @returns {Promise<void>} Resolves once the queue is empty or its
   *   remainder was reported as dropped
   */
  flushEvents() {
    if (!this.eventFlushChain) {
      this.eventFlushChain = this.drainEventQueue().finally(() => {
        this.eventFlushChain = null;
      });
    }
    return this.eventFlushChain;
  }

  async drainEventQueue() {
    if (this.eventFlushTimer) {
      clearTimeout(this.eventFlushTimer);
      this.eventFlushTimer = null;
    }
    while (this.pendingEvents.length > 0) {
      const batch = this.pendingEvents.splice(0, this.pendingEvents.length);
      await this.writeEventBatch(batch);
    }
  }

  /**
   * Persist one batch, retrying transient failures before giving up. A batch
   * that exhausts its retries is counted and reported through the logger and
   * the `onDrop` hook rather than lost silently (issue #31 acceptance 2).
   * @param {Array} batch The queued Event documents
   */
  async writeEventBatch(batch) {
    let attempt = 0;
    for (;;) {
      try {
        await EventSchema.insertMany(batch, { ordered: false });
        this.savedEventCount += batch.length;
        return;
      } catch (err) {
        if (attempt < this.eventWriteRetries) {
          attempt += 1;
          continue;
        }
        this.droppedEventCount += batch.length;
        this.logger.error(
          `[DataStorage] Cannot save ${batch.length} events after ${
            attempt + 1
          } attempts - they are NOT stored:`,
          err
        );
        if (this.onEventsDropped) {
          try {
            this.onEventsDropped(batch, err);
          } catch (hookError) {
            this.logger.error('[DataStorage] The onDrop hook itself failed:', hookError);
          }
        }
        return;
      }
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
   *
   * Any events still queued for a batched write are drained first (issue
   * #31): stopping a run must not abandon what its devices already sent.
   * @param {Function} [callback] Invoked once the queue is drained (or its
   *   remainder was reported as dropped) and the client is closed
   */
  stop(callback = null) {
    const finish = () => {
      if (this.dsClient) {
        this.dsClient.close();
      }
      if (callback) callback();
    };
    if (this.pendingEvents.length > 0 || this.eventFlushChain) {
      this.flushEvents().then(finish, finish);
    } else {
      finish();
    }
  }
}

module.exports = DataStorage;
