var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');

var dataGeneratorRouter = require('./routes/data-generator');
var simulationRouter = require('./routes/simulation');

var app = express();

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/data-generator', dataGeneratorRouter);
app.use('/api/simulation', simulationRouter);

module.exports = app;
