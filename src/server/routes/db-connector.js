
const {
  ENACTDB,
  EventSchema,
  DataSetSchema,
  TestCaseSchema,
  TestCampaignSchema
} = require("../../core/enact-mongoose");

const {
  readJSONFile,
  writeToFile,
} = require("../../core/utils");

const dataStoragePath = `${__dirname}/../data/data-storage.json`;

let dataStorageConfig = null;
let dbClient = null;

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
        console.log('[SERVER] configuration: ', dataStorageConfig);
        const {
          host,
          port,
          dbname,
          username,
          password,
          options
        } = dataStorageConfig;
        let auth = null;
        if (username && password) {
          auth = {
            userName: username,
            password
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
      console.error("[SERVER] reading data storage", err);
      const defaultDataStorage = {
        protocol: "MONGODB",
        host: "localhost",
        port: 27017,
        username: null,
        password: null,
        dbname: null,
        options: null,
      };
      writeToFile(dataStoragePath, JSON.stringify(defaultDataStorage), (err2, data) => {
        if (err2) {
          console.error("[SERVER] saving data storage", err2);
          return callback(err2);
        } else {
          dataStorageConfig = defaultDataStorage;
          return callback(null, dataStorageConfig);
        }
      }, true);
    } else {
      dataStorageConfig = data;
      return callback(null, dataStorageConfig);
    }
  });
};

const updateDataStorage = (dataStorage, callback) => {
  writeToFile(dataStoragePath, JSON.stringify(dataStorage), (err, data) => {
    if (err) {
      console.error("[SERVER] Cannot save the new data storage configuration", err);
      return callback({error: err});
    } else {
      dataStorageConfig = dataStorage;
      return callback({
        error: null,
        dataStorage
      });
    }
  }, true);
};


const dbConnector = (req, res, next) => {
  getDBClient((err, dbClient) => {
    if (err) {
      console.error('[SERVER] Failed to get database client', err);
      res.send({
        error: 'Failed to get database client!'
      });
    } else {
      next();
    }
  });
};

module.exports = {
  getDataStorage,
  updateDataStorage,
  dbConnector,
  EventSchema,
  DataSetSchema,
  TestCaseSchema,
  TestCampaignSchema
}

