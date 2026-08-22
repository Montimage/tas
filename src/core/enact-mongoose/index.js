const mongoose = require('mongoose');
mongoose.set('useFindAndModify', false);
mongoose.set('useUnifiedTopology', true);
// Schemas
const SensorSchema = require('./schemas/SensorSchema');
const ActuatorSchema = require('./schemas/ActuatorSchema');
const EventSchema = require('./schemas/EventSchema');
const ReportSchema = require('./schemas/ReportSchema');
const DatasetSchema = require('./schemas/DatasetSchema');
const TestCaseSchema = require('./schemas/TestCaseSchema');
const TestCampaignSchema = require('./schemas/TestCampaignSchema');

function ENACTDB(host, port, dbName, auth = null) {
  this.host = host;
  this.port = port;
  this.dbName = dbName;
  this.auth = auth;
  this.isConnected = false;
}

ENACTDB.prototype.connect = function (callback) {
  if (this.isConnected) {
    console.log('[ENACTDB] Already connected!');
    return callback();
  }

  const connString = `mongodb://${this.host}:${this.port}`;

  console.log('[ENACTDB] Connection string: ', connString);

  const connectOptions = {
    dbName: this.dbName,
    useNewUrlParser: true,
    autoIndex: false,
  };

  if (this.auth) {
    connectOptions['user'] = this.auth.username;
    connectOptions['pass'] = this.auth.password;
  }

  mongoose.connect(connString, connectOptions, (error) => {
    if (error) {
      console.error('[ENACTDB] ', error);
      return callback(error);
    }
    if (mongoose.connection.readyState !== 1) {
      console.error(
        `[ENACTDB] connect resolved while readyState=${mongoose.connection.readyState}`
      );
      return callback(new Error('database connection did not reach the connected state'));
    }
    console.log('[ENACTDB] New connection to database has been established!');
    this.isConnected = true;
    return callback(null);
  });
};

/**
 * Close the connection.
 *
 * @param {Function} [callback] Invoked once Mongoose has finished tearing the
 *   connection down, so a graceful shutdown can wait for it before exiting.
 */
ENACTDB.prototype.close = function (callback) {
  console.log('[ENACTDB] Going to close the connection');
  mongoose.disconnect(callback);
};

module.exports = {
  ENACTDB,
  ReportSchema,
  SensorSchema,
  ActuatorSchema,
  EventSchema,
  DatasetSchema,
  TestCaseSchema,
  TestCampaignSchema,
};
