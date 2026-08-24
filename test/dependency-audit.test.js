/**
 * Dependency-audit gate for the Phase 4 milestone (issue #33).
 *
 * Asserts the dependency audit reports no high or critical vulnerabilities
 * for the server manifest — the same assertion CI enforces on every pull
 * request via `node scripts/audit-gate.js`, proven here from the suite so the
 * milestone gate carries it even when CI is not watching.
 *
 * Both paths need the npm registry (the advisory database is a network
 * service), so the file probes reachability first and skips politely when it
 * cannot be reached, exactly like the broker/database gates in `test/e2e/`.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const https = require('node:https');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const repoRoot = path.resolve(__dirname, '..');
const {
  blockingAdvisories,
  evaluate,
  runAuditJson,
  ALLOWLIST_PATH,
} = require('../scripts/audit-gate');

/** Whether the npm advisory endpoint answers at all; cached across tests. */
let registryUp = null;

const registryReachable = () =>
  new Promise((resolve) => {
    if (registryUp !== null) return resolve(registryUp);
    const request = https.request(
      { host: 'registry.npmjs.org', path: '/-/ping', method: 'GET', timeout: 5000 },
      (response) => {
        response.resume();
        registryUp = true;
        resolve(true);
      }
    );
    request.on('timeout', () => {
      request.destroy();
      registryUp = false;
      resolve(false);
    });
    request.on('error', () => {
      registryUp = false;
      resolve(false);
    });
    request.end();
  });

test('the server manifest reports no high or critical advisories beyond the allowlist', async (t) => {
  if (!(await registryReachable())) {
    return t.skip('npm registry unreachable - a live audit cannot run here');
  }

  const payload = runAuditJson();
  const allowlist = JSON.parse(fs.readFileSync(ALLOWLIST_PATH, 'utf8'));
  const { unlisted, stale } = evaluate(payload, allowlist);

  assert.deepEqual(
    unlisted,
    [],
    `unallowlisted high/critical production advisories present:\n${unlisted.join('\n')}`
  );
  assert.deepEqual(
    stale,
    [],
    'the allowlist must stay exact: entries whose advisory no longer occurs are stale'
  );
});

test('every blocking advisory the audit finds is allowlisted or absent', async (t) => {
  if (!(await registryReachable())) {
    return t.skip('npm registry unreachable - a live audit cannot run here');
  }

  const payload = runAuditJson();
  const allowlist = JSON.parse(fs.readFileSync(ALLOWLIST_PATH, 'utf8'));
  const listed = new Set(Object.keys(allowlist).map((id) => id.toLowerCase()));
  for (const advisory of blockingAdvisories(payload)) {
    assert.ok(
      advisory.ghsas.some((id) => listed.has(id.toLowerCase())),
      `${advisory.name} (${advisory.severity}) blocks without an allowlist entry`
    );
  }
});

test('the audit gate command CI runs exits clean', async (t) => {
  if (!(await registryReachable())) {
    return t.skip('npm registry unreachable - a live audit cannot run here');
  }

  let stdout = '';
  try {
    stdout = execFileSync(process.execPath, ['scripts/audit-gate.js'], {
      cwd: repoRoot,
      encoding: 'utf8',
      timeout: 120000,
    });
  } catch (error) {
    assert.fail(
      `node scripts/audit-gate.js exited ${error.status}:\n${error.stdout || ''}\n${
        error.stderr || error.message
      }`
    );
  }
  assert.match(stdout, /audit-gate/, 'the gate must report its verdict');
});
