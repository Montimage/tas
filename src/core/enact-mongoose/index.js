const mongoose = require("mongoose");
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

ENACTDB.prototype.connect = function(callback) {

  if (this.isConnected) {
    console.log('[ENACTDB] Already connected!');
    return callback();
  }

  const connString = `mongodb://${this.host}:${this.port}`;

  console.log("[ENACTDB] Connection string: ", connString);

  const connectOptions = {
    dbName: this.dbName,
    useNewUrlParser: true,
    autoIndex: false
  };

  if (this.auth) {
    connectOptions['user'] = this.auth.username;
    connectOptions['pass'] = this.auth.password;
  }

  mongoose.connect(connString, connectOptions, error => {
    if (error) {
      console.error('[ENACTDB] ',error);
      return callback(error);
    }
    console.log("[ENACTDB] New connection to database has been established!");
    this.isConnected = true;
    return callback(null);
  });
};

ENACTDB.prototype.close = function() {
  console.log("[ENACTDB] Going to close the connection");
  mongoose.disconnect();
};

module.exports = {
  ENACTDB,
  ReportSchema,
  SensorSchema,
  ActuatorSchema,
  EventSchema,
  DatasetSchema,
  TestCaseSchema,
  TestCampaignSchema
};