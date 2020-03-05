var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
const dotenv = require('dotenv');

// read and pass the environment variables into reactjs application
const env = dotenv.config().parsed;

var dataGeneratorRouter = require('./routes/data-generator');
var simulationRouter = require('./routes/simulation');

var app = express();

app.set("port", env.REST_API_SERVER_PORT);

app.use(bodyParser.json({limit: '50mb'}));
app.use(bodyParser.urlencoded({limit: '50mb',  extended: true }))
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// start server

var server = app.listen(app.get('port'), env.REST_API_SERVER_HOST, function () {
   console.log('info',`Test and Simulation API Server started on: http://${env.REST_API_SERVER_HOST}:${env.REST_API_SERVER_PORT}`);
});

// Add headers
app.use((req, res, next) => {
  // Website you wish to allow to connect
  // res.setHeader('Access-Control-Allow-Origin', 'http://mmt.box');
  res.setHeader('Access-Control-Allow-Origin', '*');

  // Request methods you wish to allow
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST');

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

app.use('/api/data-generator', dataGeneratorRouter);
app.use('/api/simulation', simulationRouter);