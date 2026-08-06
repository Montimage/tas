const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { loadConfig, DEFAULT_CONFIG } = require('../src/server/config');

test('loadConfig returns documented defaults when no .env exists', () => {
  const missing = path.join(os.tmpdir(), `missing-${Date.now()}-${Math.random()}.env`);
  const cfg = loadConfig({ path: missing });
  assert.strictEqual(cfg.SERVER_HOST, '0.0.0.0');
  assert.strictEqual(cfg.SERVER_PORT, '3004');
  assert.strictEqual(cfg.DEV_DASHBOARD_PORT, '8080');
});

test('loadConfig merges values from an existing env file over defaults', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tas-env-test-'));
  const envFile = path.join(tmp, '.env');
  fs.writeFileSync(envFile, 'SERVER_PORT=7777\nDEV_DASHBOARD_PORT=9999\n');
  const cfg = loadConfig({ path: envFile });
  assert.strictEqual(cfg.SERVER_PORT, '7777');
  assert.strictEqual(cfg.DEV_DASHBOARD_PORT, '9999');
  assert.strictEqual(cfg.SERVER_HOST, '0.0.0.0');
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('DEFAULT_CONFIG is documented in env.example', () => {
  const example = fs.readFileSync(path.join(__dirname, '..', 'env.example'), 'utf8');
  const parsed = {};
  for (const line of example.split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) parsed[m[1]] = m[2];
  }
  for (const [key, value] of Object.entries(DEFAULT_CONFIG)) {
    assert.ok(key in parsed, `env.example should document ${key}`);
    assert.strictEqual(parsed[key], value, `env.example value for ${key}`);
  }
});
