var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var compression = require('compression');
var rateLimit = require('express-rate-limit');
var { loadConfig } = require('./config');
var { errorHandler, apiNotFound, forbidden, ApiError, sendError } = require('./middleware/errors');
var { securityHeaders } = require('./middleware/security-headers');
var { createAuthMiddleware } = require('./middleware/auth');
var { createCsrfMiddleware } = require('./middleware/csrf');
var { createCredential } = require('./auth/credentials');
var { createSessionStore } = require('./auth/session-store');

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
const healthRouter = require('./routes/health');
const createAuthRouter = require('./routes/auth');

/**
 * The single administrator credential and the session table, built once.
 *
 * Both are process-wide by design: there is one operator account, and the
 * session table is the thing that makes a session revocable (see
 * `auth/session-store.js`).
 *
 * `createCredential` hashes any plaintext bootstrap password and erases it from
 * the configuration object as it goes, so what this module holds for the
 * lifetime of the process — and hands to the middleware, the router and the
 * cookie helpers — no longer carries the plaintext at all.
 */
const credential = createCredential(config);
const sessions = createSessionStore({
  idleTtlMs: config.sessionIdleTtlMs,
  absoluteTtlMs: config.sessionAbsoluteTtlMs,
  maxSessions: config.sessionMaxRecords,
});

if (!credential.configured) {
  console.error(
    '[AUTH] No administrator credential configured — every API endpoint will reject requests. Set AUTH_ADMIN_PASSWORD or AUTH_ADMIN_PASSWORD_HASH.'
  );
}
if (config.authTrustProxyHeader === true && config.authTrustedProxies.length === 0) {
  console.error(
    '[AUTH] AUTH_TRUST_PROXY_HEADER is enabled but AUTH_TRUSTED_PROXIES is empty — proxy identity delegation stays disabled.'
  );
}

var app = express();

/**
 * Parse query strings with Node's own parser rather than Express's default.
 *
 * The default ("extended") parser reads bracket notation, so `?a[$ne]=1`
 * arrives as the object `{ a: { $ne: '1' } }` and, where a handler copies a
 * query value into a database filter, silently becomes a query operator. With
 * the simple parser every query value is a string or an array of strings, so
 * that shape cannot be constructed at all. The per-endpoint schemas in
 * `middleware/validate` enforce the same rule declaratively; this makes it
 * structurally impossible one layer earlier.
 */
app.set('query parser', 'simple');

app.use(compression()); //Compress all routes

/**
 * Security response headers, including an explicit Content Security Policy.
 *
 * The policy is written out in `middleware/security-headers.js` from what the
 * dashboard bundle actually loads, rather than inherited from the middleware's
 * defaults. It is enforced by default so the policy actually blocks; a
 * deployment that wants to observe violations first can set
 * `CSP_REPORT_ONLY=true` to ship it in report-only mode.
 */
app.use(
  securityHeaders({
    reportOnly: config.cspReportOnly,
    reportUri: config.cspReportUri,
  })
);
app.set('port', config.port);

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
    // Reject cross-origin requests from unlisted origins. Reported through the
    // central handler like every other refusal, so the API has one error shape.
    return sendError(res, forbidden('Origin not allowed'));
  }

  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  // X-CSRF-Token is part of every state-changing request the dashboard makes,
  // so a cross-origin dashboard configured through CORS_ALLOWED_ORIGINS cannot
  // work without the browser being told the header is permitted.
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-CSRF-Token');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }

  next();
});

app.use(
  bodyParser.json({
    limit: config.bodyLimit,
  })
);
app.use(
  bodyParser.urlencoded({
    limit: config.bodyLimit,
    extended: true,
  })
);
// The secret is what makes `signed: true` cookies verifiable: a session cookie
// that was edited or minted by anything but this process fails the signature
// check and never reaches the session table.
app.use(cookieParser(config.sessionSecret));
app.use(express.static(path.join(__dirname, '../public')));

// Per-client rate limiting on the unauthenticated API surface.
const apiLimiter = rateLimit({
  windowMs: config.rateLimitWindowMs,
  max: config.rateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  // Reported through the central handler rather than written here, so a client
  // that is over the limit reads the same error shape as every other refusal.
  handler: function (req, res, next) {
    next(new ApiError(429, 'Too many requests, please try again later.'));
  },
});

app.use('/api', apiLimiter);

/**
 * A second, much tighter limit on the login endpoint alone.
 *
 * `skipSuccessfulRequests` is what makes it usable: only *failed* logins count
 * towards it, so an operator who mistypes a password a few times is unaffected
 * while a credential-guessing run is cut off after a handful of attempts. The
 * general API limit above is far too loose to be that ceiling.
 */
const loginLimiter = rateLimit({
  windowMs: config.authLoginRateLimitWindowMs,
  max: config.authLoginRateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler: function (req, res, next) {
    next(new ApiError(429, 'Too many login attempts, please try again later.'));
  },
});

app.use('/api/auth/login', loginLimiter);

/**
 * Everything under /api requires a session, bar the short allowlist declared in
 * `middleware/auth.js`; every state-changing request additionally has to echo
 * the token bound to that session (`middleware/csrf.js`). Both are mounted here,
 * ahead of every router, so a route added later is closed by default rather
 * than open until somebody remembers to guard it.
 */
app.use(
  '/api',
  createAuthMiddleware({ credential: credential, sessions: sessions, config: config })
);
app.use('/api', createCsrfMiddleware());

app.use('/api/health', healthRouter);
app.use(
  '/api/auth',
  createAuthRouter({ credential: credential, sessions: sessions, config: config })
);

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
// An API path no router claimed is a missing resource, not the dashboard: it
// must not fall through to the single-page app below, which would answer 200
// with an HTML page a client cannot tell from a successful call.
app.use('/api', apiNotFound);

app.get('/*', function (req, res) {
  res.sendFile(path.join(__dirname, '../public', 'index.html'));
});

/**
 * The central error handler.
 *
 * Every failure the API reports is rendered here, in one shape, with the
 * underlying error kept server-side (`middleware/errors.js`). Registered last
 * so it also catches what happens before any route runs — a body over the
 * configured limit, a malformed JSON body — which would otherwise reach
 * Express's default handler and be answered with an HTML stack trace.
 */
app.use(errorHandler);

module.exports = app;

if (require.main === module) {
  var _server = app.listen(app.get('port'), config.host, function () {
    console.log(
      `[SERVER] Test and Simulation Server started on: http://${config.host}:${config.port}`
    );
  });
}
