var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
const dotenv = require('dotenv');

// read and pass the environment variables into reactjs application
const env = dotenv.config().parsed;

const simulationRouter = require('./routes/simulation');
const modelRouter = require('./routes/model');
const dataRecorderRouter = require('./routes/data-recorders');
const dataStorageRouter = require('./routes/data-storage');
const createLogRouter = require('./routes/logs');
const reportRouter = require('./routes/reports');
const testCaseRouter = require('./routes/test-cases');
const testCampaignRouter = require('./routes/test-campaigns');
const dataSetRouter = require('./routes/data-sets');
const eventRouter = require('./routes/events');
const devoptsRouter = require('./routes/devopts');

var app = express();
var compression = require('compression');
var helmet = require('helmet');

app.use(compression()); //Compress all routes
app.use(helmet());
app.set("port", env.SERVER_PORT);

app.use(bodyParser.json({
  limit: '50mb'
}));
app.use(bodyParser.urlencoded({
  limit: '50mb',
  extended: true
}))
app.use(cookieParser());
app.use(express.static(path.join(__dirname, '../public')));

// Add headers
app.use((req, res, next) => {
  // Website you wish to allow to connect
  // res.setHeader('Access-Control-Allow-Origin', 'http://mmt.box');
  res.setHeader('Access-Control-Allow-Origin', '*');

  // Request methods you wish to allow
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE');

  // Request headers you wish to allow
  res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With, content-type, authorization');

  // Set to true if you need the website to include cookies in the requests sent
  // to the API (e.g. in case you use sessions)
  res.setHeader('Access-Control-Allow-Credentials', true);

  // Log the request
  // logInfo(`${req.method} ${req.protocol}://${req.hostname}${req.path} ${res.statusCode}`);
  // Pass to next layer of middleware
  next();
});

app.use('/api/models', modelRouter);
app.use('/api/data-recorders', dataRecorderRouter);
app.use('/api/data-storage', dataStorageRouter);
app.use('/api/logs/data-recorders', createLogRouter('data-recorders'));
app.use('/api/logs/simulations', createLogRouter('simulations'));
app.use('/api/logs/test-campaigns', createLogRouter('test-campaigns'));
app.use('/api/data-sets', dataSetRouter);
app.use('/api/test-cases', testCaseRouter);
app.use('/api/test-campaigns', testCampaignRouter);
app.use('/api/events', eventRouter);
app.use('/api/reports', reportRouter);
app.use('/api/simulation', simulationRouter);
app.use('/api/devopts', devoptsRouter);
app.get('/*', function (req, res) {
  res.sendFile(path.join(__dirname, '../public', 'index.html'));
});
// start server

var server = app.listen(app.get('port'), env.SERVER_HOST, function () {
  console.log(`[SERVER] Test and Simulation Server started on: http://${env.SERVER_HOST}:${env.SERVER_PORT}`);
});