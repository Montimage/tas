
const {
  ENACTDB,
  EventSchema,
  ReportSchema,
  DatasetSchema,
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
      if (err || !dataStorage) {
        console.error('[SERVER] Cannot get the data storage configuration');
        return callback(err);
      } else {
        const { protocol, connConfig} = dataStorage;
        if(protocol === 'MONGODB') {
          const {
            host,
            port,
            dbname,
            username,
            password,
            options
          } = connConfig;
          console.log(`MongoDB configuration: ${JSON.stringify(connConfig)}`);
          let auth = null;
          if (username && password) {
            auth = {
              username: username,
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
  if (dataStorageConfig && !reload) return callback(null, dataStorageConfig);
  return readJSONFile(dataStoragePath, (err, data) => {
    if (err) {
      console.error("[SERVER] reading data storage", err);
      const defaultDataStorage = {
        protocol: "MONGODB",
        connConfig:{
          host: "localhost",
          port: 27017,
          username: null,
          password: null,
          dbname: null,
          options: null
        }
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
      return callback(err);
    } else {
      dataStorageConfig = dataStorage;
      if (dbClient) {
        dbClient.close();
        dbClient = null;
      }
      getDBClient((err2, dbClient) => {
        if (err) {
          console.error('[SERVER] Failed to get database client', err);
          res.send({
            error: 'Failed to get database client!'
          });
        } else {
          return callback(null,
            dataStorage
          );
        }
      }, true);
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
  ReportSchema,
  EventSchema,
  DatasetSchema,
  TestCaseSchema,
  TestCampaignSchema
}

