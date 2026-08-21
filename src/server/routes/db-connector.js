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
 * Get the db client
 * @param {Function} callback The callback function
 */
const getDBClient = (callback, reload = false) => {
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
        const { protocol, connConfig } = dataStorage;
        // A malformed configuration (connConfig missing or not an object) must
        // be reported as an unavailable database (503), not destructured and
        // thrown as a TypeError. (F-BUG-002)
        if (!connConfig || typeof connConfig !== 'object') {
          console.error('[db-connector] data-storage configuration is missing connConfig');
          return callback(new Error('data-storage configuration is missing connConfig'));
        }
        if (protocol === 'MONGODB') {
          const { host, port, dbname, username, password, _options } = connConfig;
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
          dbClient = new ENACTDB(host, port, dbname, auth);
          dbClient.connect((err2) => {
            if (err2) {
              console.error('[SERVER] Cannot connect to the database');
              return callback(err2);
            } else {
              return callback(null, dbClient);
            }
          });
        } else {
          console.error(`[db-connector] Protocol is not supported ${protocol}`);
          return callback(`Protocol is not supported ${protocol}`);
        }
      }
    }, reload);
  }
};

///////////////
// Data Storage
///////////////
// Read a specific model by its name:

const getDataStorage = (callback, reload = false) => {
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
  writeToFile(
    dataStoragePath,
    JSON.stringify(dataStorage),
    (err, data) => {
      if (err) {
        console.error('[SERVER] Cannot save the new data storage configuration', err);
        return callback(err);
      } else {
        dataStorageConfig = dataStorage;
        if (dbClient) {
          dbClient.close();
          dbClient = null;
        }
        getDBClient((err2) => {
          if (err2) {
            // The configuration asked for *was* written, so the update itself
            // succeeded; only the connection it names is not answering. Report
            // the save as done and keep the connection failure in the log —
            // `GET /api/data-storage/test` is what probes the connection.
            // (This branch used to test the wrong variable and then reference an
            // `res` that does not exist here, so it could only ever have thrown.)
            console.error(
              `[SERVER] Data storage saved, but its connection is not reachable | ${
                err2 && err2.stack ? err2.stack : err2
              }`
            );
          }
          return callback(null, dataStorage);
        }, true);
      }
    },
    true
  );
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

module.exports = {
  getDataStorage,
  updateDataStorage,
  dbConnector,
  ReportSchema,
  EventSchema,
  DatasetSchema,
  TestCaseSchema,
  TestCampaignSchema,
};
