var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var compression = require('compression');
var helmet = require('helmet');
var rateLimit = require('express-rate-limit');
var { loadConfig } = require('./config');

// Read the environment configuration once at startup.
const config = loadConfig();

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
const devopsRouter = require('./routes/devops');

var app = express();

app.use(compression()); //Compress all routes
app.use(helmet());
app.set("port", config.port);

/**
 * Cross-origin access control.
 *
 * The SPA is served from the same origin as the API, so by default only
 * same-origin requests are accepted and cross-origin requests from unlisted
 * origins are rejected. Operators may opt specific origins in through the
 * CORS_ALLOWED_ORIGINS configuration value.
 *
 * Permitted methods and headers are limited to what the API actually uses
 * (GET, POST, DELETE and the Content-Type header).
 */
app.use(function corsControl(req, res, next) {
  const origin = req.get('Origin');

  if (!origin) {
    return next();
  }

  // Compare against the Host header only (not the scheme). Behind a
  // TLS-terminating reverse proxy, req.protocol reports 'http' while the
  // browser's Origin carries the external scheme (https); comparing the
  // full scheme+host would falsely reject legitimately same-origin requests.
  const authorityMatch = /^https?:\/\/([^/]+)/.exec(origin);
  const isSameOrigin = authorityMatch !== null && authorityMatch[1] === req.get('host');

  if (isSameOrigin) {
    res.setHeader('Vary', 'Origin');
    return next();
  }

  const isAllowed = config.corsAllowedOrigins.indexOf(origin) !== -1;

  if (!isAllowed) {
    // Reject cross-origin requests from unlisted origins.
    return res.status(403).json({ error: 'Origin not allowed' });
  }

  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }

  next();
});

app.use(bodyParser.json({
  limit: config.bodyLimit
}));
app.use(bodyParser.urlencoded({
  limit: config.bodyLimit,
  extended: true
}));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, '../public')));

// Per-client rate limiting on the unauthenticated API surface.
const apiLimiter = rateLimit({
  windowMs: config.rateLimitWindowMs,
  max: config.rateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' }
});

app.use('/api', apiLimiter);

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
app.use('/api/devops', devopsRouter);
app.get('/*', function (req, res) {
  res.sendFile(path.join(__dirname, '../public', 'index.html'));
});

// Error handler: surface body-parser limit errors as JSON 413 without
// unbounded buffering.
app.use(function (err, req, res, next) {
  if (err && err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Request entity too large' });
  }
  next(err);
});

module.exports = app;

if (require.main === module) {
  var server = app.listen(app.get('port'), config.host, function () {
    console.log(`[SERVER] Test and Simulation Server started on: http://${config.host}:${config.port}`);
  });
}