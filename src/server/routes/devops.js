/* Working with Data Generator */
var express = require('express');
const Joi = require('joi');
const { dbConnector, getDataStorage } = require('./db-connector');
const { startTestCampaign } = require('../../core/devops-flow');
let router = express.Router();
const devopsFilePath = `${__dirname}/../data/devops.json`;
let getLogger = require('../logger');
const { readJSONFile, writeToFile } = require('../../core/utils');
const { isValidName, resolveWithin, sendBadRequest } = require('./path-safety');
const {
  validate,
  documentSchema,
  safeNameSchema,
  urlSchema,
  dataStorageSchema,
} = require('../middleware/validate');
const {
  errorHandler,
  badRequest,
  conflict,
  internal,
  unavailable,
} = require('../middleware/errors');
let logsPath = `${__dirname}/../logs/test-campaigns/`;
// Running-campaign records and handles live in the shared runtime registry
// (issue #29): the record persists across restarts and is visible to a second
// server process on the same store; the live campaign object stays with the
// process that started it.
const runtimeState = require('../runtime-state');
const CAMPAIGN_KIND = 'test-campaigns';
// The single slot a store tracks campaigns in: one campaign runs at a time.
const SLOT_ID = 'active';

// ---------------------------------------------------------------------------
// Validation schemas for the devops endpoints (issue #10)
// ---------------------------------------------------------------------------

// `testCampaignId` becomes part of a log filename, so it is held to the
// filename allowlist here rather than only where the path is derived. A
// configuration may carry no campaign at all, but an empty one is not the same
// thing as an absent one: it names no campaign and would interpolate into a
// filename as nothing, so `null` is accepted and `""` is not.
const devopsBody = Joi.object({
  devops: documentSchema({
    webhookURL: urlSchema.allow(null, ''),
    testCampaignId: safeNameSchema.allow(null),
    // Persisted, then handed to the test campaign flow, which builds a
    // `DataStorage` from it — the same sink a simulation's own connection
    // reaches, so it is held to the same shape.
    dataStorage: dataStorageSchema.allow(null),
    evaluationParameters: Joi.object().allow(null),
  }).required(),
}).required();

/**
 * Strip the registry's bookkeeping fields from a record before it reaches a
 * response: clients see the run, not which pid owns it.
 */
const publicRecord = (record) => {
  if (!record) return record;
  const { owner, kind, status, ...rest } = record;
  void owner;
  void kind;
  void status;
  return rest;
};

/**
 * The campaign this store says is running, if any: the persisted record, or
 * null when nothing is. Orphaned records - whose owner died uncleanly - are
 * reaped on the way, because nothing can ever stop them again.
 */
const runningCampaign = async () => {
  await runtimeState.reconcile(CAMPAIGN_KIND);
  const records = await runtimeState.list(CAMPAIGN_KIND);
  return records.length > 0 ? records[0] : null;
};

/**
 * Get the running status of test campaign
 */
router.get('/status', validate(), (req, res, next) => {
  runningCampaign()
    .then((record) => {
      // The in-memory extras (data storage, webhook) only exist on the
      // process that started the run; the persisted part is what any
      // observer can know for sure.
      const handle = record ? runtimeState.getHandle(CAMPAIGN_KIND, record.id) : null;
      const composed = record
        ? { ...publicRecord(record), ...(handle && handle.extra), isRunning: true }
        : null;
      res.send({
        runningStatus: composed,
      });
    })
    .catch(next);
});

let _devops = null;

const getDevops = (callback) => {
  if (_devops) return callback(null, _devops);
  readJSONFile(devopsFilePath, (err, data) => {
    if (err) {
      return callback(err);
    } else {
      _devops = data;
      return callback(null, data);
    }
  });
};

router.get('/', validate(), function (req, res, next) {
  getDevops((err, devO) => {
    if (err) {
      // The raw fs error carries the absolute path of devops.json in its own
      // enumerable properties. Reporting it through the central handler is what
      // keeps that detail in the log and out of the response.
      next(internal('Cannot get devops configuration', err));
    } else {
      res.send({
        devops: devO,
      });
    }
  });
});

// Save the default devops
router.post('/', validate({ body: devopsBody }), function (req, res, next) {
  const { devops } = req.body;
  // The test campaign id becomes part of a log filename in GET /start, so a
  // hostile value must never reach the persisted configuration in the first
  // place. That is now the schema's job: `devopsBody` holds the id to the same
  // filename allowlist, so nothing hostile gets this far. The read-back guard
  // in `loadValidatedDevops` still stands, for configurations an older build
  // may have written.
  writeToFile(
    devopsFilePath,
    JSON.stringify(devops),
    (err, data) => {
      if (err) {
        next(internal('Cannot save the devops configuration', err));
      } else {
        _devops = devops;
        res.send({
          devops,
        });
      }
    },
    true
  );
});

/**
 * Load the persisted devops configuration and reject it before any further
 * work when its test campaign id cannot safely derive a log filename.
 *
 * This runs ahead of `dbConnector` on purpose: the containment decision must
 * not depend on a reachable database, otherwise a hostile configuration is
 * only rejected on instances that happen to have one.
 */
const loadValidatedDevops = (req, res, next) => {
  getDevops((err, devops) => {
    if (err) {
      // The raw fs error carries the absolute path of devops.json in its own
      // enumerable properties. Reporting it through the central handler is what
      // keeps that detail in the log and out of the response.
      return next(internal('Cannot get devops configuration', err));
    }
    const { testCampaignId } = devops || {};
    if (!testCampaignId) {
      return next(badRequest('Test campaign Id must not be null'));
    }
    // A configuration written by an older, unvalidated build can still hold a
    // hostile id, so read-back is checked as well as write.
    if (!isValidName(testCampaignId)) {
      return sendBadRequest(res, 'Invalid test campaign id');
    }
    req.devops = devops;
    return next();
  });
};

router.get('/start', validate(), loadValidatedDevops, dbConnector, (req, res, next) => {
  const devops = req.devops;
  const { webhookURL, testCampaignId, dataStorage, evaluationParameters } = devops;

  // One campaign runs at a time, and the store is the truth: a campaign this
  // process or another live process started is a conflict, where the old
  // module-level variable silently orphaned the previous run. The single slot
  // is claimed BEFORE anything asynchronous runs, so a second /start arriving
  // meanwhile sees the reservation instead of racing this one past the check.
  if (runtimeState.isReserved(CAMPAIGN_KIND, SLOT_ID)) {
    return next(conflict('A test campaign is already running'));
  }
  runtimeState.reserve(CAMPAIGN_KIND, SLOT_ID);
  const releaseSlot = () => runtimeState.releaseReservation(CAMPAIGN_KIND, SLOT_ID);

  function beginStart() {
    const startedTime = Date.now();
    const logFile = `${testCampaignId}_${startedTime}.log`;
    // The logger creates missing parent directories, so an escaping filename
    // would write outside the log root rather than fail. Resolve and contain it.
    const logFilePath = resolveWithin(logsPath, logFile);
    if (!logFilePath) {
      releaseSlot();
      return sendBadRequest(res, 'Invalid test campaign id');
    }
    const logger = getLogger('TEST-CAMPAIGN', logFilePath);
    logger.log('[devops] A test campaign is going to be started ...');

    const launch = async (storage, withDevops) => {
      const record = {
        id: SLOT_ID,
        isRunning: true,
        testCampaignId,
        startedTime,
        endTime: null,
        logFile,
      };
      // The run's own logger and live campaign object are held in the registry
      // alongside the record, so /stop can reach them from this process.
      const campaign = startTestCampaign(
        testCampaignId,
        storage,
        webhookURL,
        evaluationParameters,
        logger
      );
      await runtimeState
        .register(CAMPAIGN_KIND, record, {
          run: campaign || null,
          logger,
          extra: { dataStorage: storage, webhookURL },
        })
        // Persistence failures degrade to memory-only tracking; they never
        // fail a start that itself succeeded.
        .catch(() => {});
      // The slot stays claimed until the record is in: releasing first would
      // reopen exactly the race the reservation exists to close. The start
      // answer follows the persisted record for the same reason.
      releaseSlot();
      res.send({
        error: null,
        // The explicit-storage branch has always echoed the configuration
        // back; the default-storage branch never did.
        ...(withDevops ? { devops } : {}),
        runningStatus: { ...record, dataStorage: storage, webhookURL },
      });
    };

    if (dataStorage) {
      launch(dataStorage, true);
    } else {
      getDataStorage((err, ds) => {
        if (err) {
          releaseSlot();
          next(unavailable('Cannot get data storage', err));
        } else {
          launch(ds, false);
        }
      });
    }
  }

  runningCampaign()
    .then((record) => {
      if (record) {
        releaseSlot();
        return next(conflict('A test campaign is already running'));
      }
      beginStart();
    })
    .catch((err) => {
      releaseSlot();
      next(err);
    });
});

router.get('/stop', validate(), (req, res, next) => {
  stopCampaign()
    .then((copiedStatus) => {
      res.send({
        error: null,
        runningStatus: copiedStatus,
      });
    })
    .catch(next);
});

/**
 * Stop whatever campaign the store says is running, according to who owns it -
 * the same ownership rules as the simulation and recorder routers. Returns the
 * final status to report (null when nothing was running).
 */
const stopCampaign = async () => {
  const endTime = Date.now();
  let records = [];
  try {
    records = await runtimeState.list(CAMPAIGN_KIND);
  } catch (_) {
    records = [];
  }
  const record = records.length > 0 ? records[0] : null;
  const handle = record ? runtimeState.getHandle(CAMPAIGN_KIND, record.id) : null;

  if (!handle && (!record || !runtimeState.ownerIsAlive(record))) {
    // Either nothing is running, or what the store still holds belongs to a
    // process that died uncleanly - reconcile already reaped it on the way in.
    return null;
  }
  if (!handle) {
    // Another live process's campaign: visible, not stoppable from here.
    return null;
  }

  if (handle.run) {
    handle.run.stop();
  }
  if (handle.logger) {
    // The run has stopped: release its log file handle.
    handle.logger.close();
  }
  await runtimeState.reap(CAMPAIGN_KIND, record.id).catch(() => {});
  const copiedStatus = { ...publicRecord(record), isRunning: false, endTime };
  return copiedStatus;
};

// Attached to the router itself as well as to the application: see the note in
// `routes/model.js`.
router.use(errorHandler);

module.exports = router;
