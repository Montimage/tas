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

/**
 * Run `fn` with a set of environment overrides applied, restoring whatever was
 * there before — including absence — afterwards.
 * @param {Object} overrides Environment values to set
 * @param {Function} fn The assertions to run under those values
 */
function withEnv(overrides, fn) {
  var saved = {};
  Object.keys(overrides).forEach(function (key) {
    saved[key] = process.env[key];
    process.env[key] = overrides[key];
  });
  try {
    fn();
  } finally {
    Object.keys(saved).forEach(function (key) {
      if (saved[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = saved[key];
      }
    });
  }
}

/**
 * Assert that a value for a setting is refused, and that the refusal names the
 * setting so an operator can fix it.
 * @param {String} key The operator-facing configuration key
 * @param {String} value The offending raw value
 */
function assertSettingRejected(key, value) {
  assert.throws(
    function () {
      withEnv(keyValue(key, value), loadConfig);
    },
    function (err) {
      return err instanceof Error && err.message.indexOf(key) !== -1;
    },
    `${key}=${JSON.stringify(value)} must be rejected with a message naming ${key}`
  );
}

function keyValue(key, value) {
  var overrides = {};
  overrides[key] = value;
  return overrides;
}

// ---------------------------------------------------------------------------
// Numeric configuration settings (F-BUG-006): unset / zero / negative /
// non-numeric must each behave differently instead of all collapsing into the
// built-in default the way `Number(value) || default` collapsed them.
// ---------------------------------------------------------------------------

var NUMERIC_SETTINGS = [
  'RATE_LIMIT_WINDOW_MS',
  'RATE_LIMIT_MAX',
  'SESSION_TTL_MS',
  'SESSION_ABSOLUTE_TTL_MS',
  'SESSION_MAX_RECORDS',
  'AUTH_LOGIN_RATE_LIMIT_WINDOW_MS',
  'AUTH_LOGIN_RATE_LIMIT_MAX',
];

// The hardening defaults these settings resolve to when nothing is configured.
var NUMERIC_DEFAULTS = {
  RATE_LIMIT_WINDOW_MS: 15 * 60 * 1000,
  RATE_LIMIT_MAX: 1000,
  SESSION_TTL_MS: 60 * 60 * 1000,
  SESSION_ABSOLUTE_TTL_MS: 12 * 60 * 60 * 1000,
  SESSION_MAX_RECORDS: 1000,
  AUTH_LOGIN_RATE_LIMIT_WINDOW_MS: 15 * 60 * 1000,
  AUTH_LOGIN_RATE_LIMIT_MAX: 10,
};

test('numeric settings keep their safe defaults when unset or empty', function () {
  NUMERIC_SETTINGS.forEach(function (key) {
    var saved = process.env[key];
    delete process.env[key];

    try {
      // Unset resolves to the default...
      assert.strictEqual(loadConfig()[numericFieldFor(key)], NUMERIC_DEFAULTS[key]);
      // ...and so does an explicitly blank value.
      process.env[key] = '';
      assert.strictEqual(loadConfig()[numericFieldFor(key)], NUMERIC_DEFAULTS[key]);
    } finally {
      if (saved === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = saved;
      }
    }
  });
});

function numericFieldFor(key) {
  var fields = {
    RATE_LIMIT_WINDOW_MS: 'rateLimitWindowMs',
    RATE_LIMIT_MAX: 'rateLimitMax',
    SESSION_TTL_MS: 'sessionIdleTtlMs',
    SESSION_ABSOLUTE_TTL_MS: 'sessionAbsoluteTtlMs',
    SESSION_MAX_RECORDS: 'sessionMaxRecords',
    AUTH_LOGIN_RATE_LIMIT_WINDOW_MS: 'authLoginRateLimitWindowMs',
    AUTH_LOGIN_RATE_LIMIT_MAX: 'authLoginRateLimitMax',
  };
  return fields[key];
}

test('a deliberate zero on a request-count knob is honoured', function () {
  withEnv({ RATE_LIMIT_MAX: '0', AUTH_LOGIN_RATE_LIMIT_MAX: '0' }, function () {
    var cfg = loadConfig();
    assert.strictEqual(cfg.rateLimitMax, 0, 'a zero API rate limit is a lockdown, not "unset"');
    assert.strictEqual(
      cfg.authLoginRateLimitMax,
      0,
      'zero tolerated login failures is a hard login lockdown'
    );
  });
});

test('a deliberate zero on a duration or capacity knob is rejected explicitly', function () {
  [
    'RATE_LIMIT_WINDOW_MS',
    'SESSION_TTL_MS',
    'SESSION_ABSOLUTE_TTL_MS',
    'SESSION_MAX_RECORDS',
    'AUTH_LOGIN_RATE_LIMIT_WINDOW_MS',
  ].forEach(function (key) {
    assertSettingRejected(key, '0');
  });
});

test('negative values are rejected naming the setting', function () {
  [
    ['RATE_LIMIT_MAX', '-1'],
    ['RATE_LIMIT_WINDOW_MS', '-1000'],
    ['SESSION_TTL_MS', '-1'],
    ['SESSION_MAX_RECORDS', '-10'],
    ['AUTH_LOGIN_RATE_LIMIT_MAX', '-5'],
  ].forEach(function (pair) {
    assertSettingRejected(pair[0], pair[1]);
  });
});

test('non-numeric values fail at startup naming the setting', function () {
  [
    ['RATE_LIMIT_MAX', 'abc'],
    ['RATE_LIMIT_WINDOW_MS', 'fifteen minutes'],
    ['SESSION_TTL_MS', 'abc'],
    ['SESSION_ABSOLUTE_TTL_MS', '12hours'],
    ['AUTH_LOGIN_RATE_LIMIT_WINDOW_MS', 'soon'],
    ['AUTH_LOGIN_RATE_LIMIT_MAX', 'many'],
  ].forEach(function (pair) {
    assertSettingRejected(pair[0], pair[1]);
  });
});

test('valid numeric overrides still apply, from env and from the .env file alike', function () {
  withEnv({ RATE_LIMIT_MAX: '50' }, function () {
    assert.strictEqual(loadConfig().rateLimitMax, 50);
  });

  var os = require('node:os');
  var fs = require('node:fs');
  var path = require('node:path');
  var dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tas-config-'));
  var envFile = path.join(dir, '.env');
  fs.writeFileSync(envFile, 'SESSION_TTL_MS=7200000\n');

  try {
    var cfg = loadConfig({ path: envFile });
    assert.strictEqual(cfg.sessionIdleTtlMs, 7200000);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
