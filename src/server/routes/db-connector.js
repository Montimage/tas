const {
  ENACTDB,
  EventSchema,
  ReportSchema,
  DatasetSchema,
  TestCaseSchema,
  TestCampaignSchema,
} = require('../../core/enact-mongoose');

const { readJSONFile, writeToFile } = require('../../core/utils');
const { unavailable } = require('../middleware/errors');

const dataStoragePath = `${__dirname}/../data/data-storage.json`;

let dataStorageConfig = null;
let dbClient = null;

/**
 * Build an ENACTDB client from a data-storage configuration and prove it can
 * actually connect, without touching any module state.
 *
 * This is the single verification seam (#18): the lazy connection a request
 * needs (`getDBClient`), the dashboard's connection test (`dbConnector`) and
 * the save path (`updateDataStorage`) all prove connectivity here, so they can
 * never disagree about whether a configuration works.
 *
 * @param {Object} dataStorage The { protocol, connConfig } configuration
 * @param {Function} callback Invoked with (err, connectedClient)
 */
const buildConnectedClient = (dataStorage, callback) => {
  // A malformed configuration (the configuration itself missing, or connConfig
  // not an object) must be reported through the error branch, not destructured
  // and thrown as a TypeError. (F-BUG-002)
  if (!dataStorage || typeof dataStorage !== 'object') {
    console.error('[db-connector] data-storage configuration is missing');
    return callback(new Error('data-storage configuration is missing'));
  }
  const { protocol, connConfig } = dataStorage;
  if (!connConfig || typeof connConfig !== 'object') {
    console.error('[db-connector] data-storage configuration is missing connConfig');
    return callback(new Error('data-storage configuration is missing connConfig'));
  }
  if (protocol === 'MONGODB') {
    const { host, port, dbname, username, password } = connConfig;
    // Connection logging names host, port and database only: username
    // and password must never reach a log file or the logs endpoint.
    // (F-SEC-001, #72)
    console.log(`MongoDB configuration: host=${host} port=${port} dbname=${dbname}`);
    let auth = null;
    if (username && password) {
      auth = {
        username: username,
        password,
      };
    }
    const client = new ENACTDB(host, port, dbname, auth);
    return client.connect((err) => {
      if (err) {
        console.error('[SERVER] Cannot connect to the database');
        return callback(err);
      } else {
        return callback(null, client);
      }
    });
  }
  console.error(`[db-connector] Protocol is not supported ${protocol}`);
  return callback(`Protocol is not supported ${protocol}`);
};

/**
 * Get the db client
 * @param {Function} callback The callback function
 */
const getDBClient = (callback) => {
  if (dbClient) {
    if (!dbClient.isConnected) {
      dbClient.connect((err) => {
        if (err) {
          console.error('[SERVER] Cannot connect to database', err);
          return callback(err);
        } else {
          return callback(null, dbClient);
        }
      });
    } else {
      return callback(null, dbClient);
    }
  } else {
    getDataStorage((err, dataStorage) => {
      if (err) {
        console.error('[SERVER] Cannot get the data storage configuration');
        return callback(err);
      } else {
        buildConnectedClient(dataStorage, (err2, client) => {
          if (err2) {
            return callback(err2);
          }
          dbClient = client;
          return callback(null, dbClient);
        });
      }
    });
  }
};

///////////////
// Data Storage
///////////////
// Read a specific model by its name:

const getDataStorage = (callback) => {
  if (dataStorageConfig) return callback(null, dataStorageConfig);
  return readJSONFile(dataStoragePath, (err, data) => {
    if (err) {
      console.error('[SERVER] reading data storage', err);
      // The default MUST use the same nested { protocol, connConfig: {…} }
      // shape as the committed data-storage.json, otherwise getDBClient
      // destructures connConfig (undefined) and throws a TypeError inside this
      // fs callback — an uncaught exception on the fresh-volume / first-run
      // path instead of a clean 503. (F-BUG-002)
      const defaultDataStorage = {
        protocol: 'MONGODB',
        connConfig: {
          host: 'localhost',
          port: 27017,
          username: null,
          password: null,
          dbname: null,
          options: null,
        },
      };
      writeToFile(
        dataStoragePath,
        JSON.stringify(defaultDataStorage),
        (err2, data) => {
          if (err2) {
            console.error('[SERVER] saving data storage', err2);
            return callback(err2);
          } else {
            dataStorageConfig = defaultDataStorage;
            return callback(null, dataStorageConfig);
          }
        },
        true
      );
    } else {
      dataStorageConfig = data;
      return callback(null, dataStorageConfig);
    }
  });
};

const updateDataStorage = (dataStorage, callback) => {
  // Verify-then-commit (#18): a configuration that cannot connect is refused
  // outright and nothing is written, so the previously working configuration —
  // on disk and in memory — is never left broken. The probe runs through the
  // same seam (`buildConnectedClient`) the dashboard's connection test uses,
  // which is what makes Test Connection and Save agree.
  //
  // The current client is closed before probing because every ENACTDB rides
  // Mongoose's shared default connection: connecting the candidate replaces
  // that connection wholesale, so keeping the old wrapper would only leave a
  // stale handle. If the probe then fails, `dbClient` stays cleared and the
  // next `getDBClient` reconnects lazily from `dataStorageConfig` — which
  // this function has deliberately not touched yet.
  const closeCurrent = (done) => {
    if (!dbClient) return done();
    const current = dbClient;
    dbClient = null;
    return current.close(() => done());
  };
  closeCurrent(() => {
    buildConnectedClient(dataStorage, (err2, candidate) => {
      if (err2) {
        console.error(
          `[SERVER] Data storage not updated: the proposed configuration cannot be reached | ${
            err2 && err2.stack ? err2.stack : err2
          }`
        );
        return callback(
          unavailable('Data storage not updated: cannot connect to the proposed database', err2)
        );
      }
      writeToFile(
        dataStoragePath,
        JSON.stringify(dataStorage),
        (err, data) => {
          if (err) {
            console.error('[SERVER] Cannot save the new data storage configuration', err);
            // The connection was proven but persistence failed: drop the
            // verified candidate rather than run live against settings a
            // restart would not load, and let `getDBClient` rebuild from the
            // untouched previous configuration.
            dbClient = null;
            candidate.close(() => {});
            return callback(err);
          }
          // Commit: the verified candidate becomes the live client and the new
          // configuration takes effect immediately, no restart needed.
          dbClient = candidate;
          dataStorageConfig = dataStorage;
          return callback(null, dataStorage);
        },
        true
      );
    });
  });
};

/**
 * Establish the database connection a route needs, or refuse the request.
 *
 * A database that is not answering is a dependency being unavailable, not a
 * successful call: it is reported as 503 so a client, a proxy and a monitor can
 * all tell it apart from a served request without reading the body.
 */
const dbConnector = (req, res, next) => {
  getDBClient((err) => {
    if (err) {
      next(unavailable('Database is unavailable', err));
    } else {
      next();
    }
  });
};

/**
 * Close the database connection this module established, if any.
 *
 * Called once during graceful shutdown so the process does not exit with a
 * Mongoose connection still open. The client reference is cleared first so a
 * request arriving mid-shutdown cannot reconnect behind the closing back.
 * @param {Function} [callback] Invoked once the close has been initiated and
 *   Mongoose reports it finished.
 */
const closeDBClient = (callback) => {
  const done = typeof callback === 'function' ? callback : function () {};
  if (!dbClient) {
    return done();
  }
  const client = dbClient;
  dbClient = null;
  client.close(function () {
    done();
  });
};

module.exports = {
  getDataStorage,
  updateDataStorage,
  dbConnector,
  closeDBClient,
  ReportSchema,
  EventSchema,
  DatasetSchema,
  TestCaseSchema,
  TestCampaignSchema,
};
