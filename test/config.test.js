var test = require('node:test');
var assert = require('node:assert');
var { loadConfig } = require('../src/server/config');

test('config provides safe defaults without any env file', function () {
  var saved = {};
  [
    'SERVER_HOST',
    'SERVER_PORT',
    'BODY_LIMIT',
    'MAX_BODY_SIZE',
    'RATE_LIMIT_WINDOW_MS',
    'RATE_LIMIT_MAX',
    'CORS_ALLOWED_ORIGINS',
  ].forEach(function (key) {
    saved[key] = process.env[key];
    delete process.env[key];
  });

  var cfg = loadConfig();

  assert.strictEqual(cfg.host, '0.0.0.0');
  assert.strictEqual(cfg.port, '3004');
  assert.strictEqual(cfg.bodyLimit, '1mb');
  assert.strictEqual(cfg.rateLimitWindowMs, 15 * 60 * 1000);
  assert.strictEqual(cfg.rateLimitMax, 1000);
  assert.deepStrictEqual(cfg.corsAllowedOrigins, []);

  Object.keys(saved).forEach(function (key) {
    if (saved[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = saved[key];
    }
  });
});

test('config honours explicit environment overrides', function () {
  var saved = {};
  [
    'SERVER_HOST',
    'SERVER_PORT',
    'BODY_LIMIT',
    'MAX_BODY_SIZE',
    'RATE_LIMIT_WINDOW_MS',
    'RATE_LIMIT_MAX',
    'CORS_ALLOWED_ORIGINS',
  ].forEach(function (key) {
    saved[key] = process.env[key];
  });

  process.env.SERVER_HOST = '127.0.0.1';
  process.env.SERVER_PORT = '9999';
  process.env.BODY_LIMIT = '25mb';
  process.env.RATE_LIMIT_WINDOW_MS = '60000';
  process.env.RATE_LIMIT_MAX = '50';
  process.env.CORS_ALLOWED_ORIGINS = 'https://ops.example.com, https://dash.example.com';

  var cfg = loadConfig();

  assert.strictEqual(cfg.host, '127.0.0.1');
  assert.strictEqual(cfg.port, '9999');
  assert.strictEqual(cfg.bodyLimit, '25mb');
  assert.strictEqual(cfg.rateLimitWindowMs, 60000);
  assert.strictEqual(cfg.rateLimitMax, 50);
  assert.deepStrictEqual(cfg.corsAllowedOrigins, [
    'https://ops.example.com',
    'https://dash.example.com',
  ]);

  Object.keys(saved).forEach(function (key) {
    if (saved[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = saved[key];
    }
  });
});

test('config normalises the body limit value even when both env keys are set', function () {
  var savedBody = process.env.BODY_LIMIT;
  var savedMax = process.env.MAX_BODY_SIZE;
  process.env.BODY_LIMIT = '';
  process.env.MAX_BODY_SIZE = '10mb';

  assert.strictEqual(loadConfig().bodyLimit, '10mb');

  if (savedBody === undefined) {
    delete process.env.BODY_LIMIT;
  } else {
    process.env.BODY_LIMIT = savedBody;
  }
  if (savedMax === undefined) {
    delete process.env.MAX_BODY_SIZE;
  } else {
    process.env.MAX_BODY_SIZE = savedMax;
  }
});
