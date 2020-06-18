const {
  ENACTDB,
  RecordedDataSchema,
  DataSetSchema
} = require('../enact-mongoose');

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
          console.log(
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
  save(data) {
    const rcData = new RecordedDataSchema(data);
    rcData.save();
  }

  saveDataSet(dataset) {
    const newDS = new DataSetSchema({...dataset, createdAt: Date.now()});
    newDS.save();
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