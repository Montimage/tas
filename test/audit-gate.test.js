const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const {
  blockingAdvisories,
  evaluate,
  runAuditJson,
  ALLOWLIST_PATH,
} = require('../scripts/audit-gate');

function auditPayload(vulns) {
  return { vulnerabilities: vulns };
}

function advisory(severity, sources) {
  return {
    severity,
    via: sources.map((source) => ({ source, url: `https://github.com/advisories/GHSA-${source}` })),
  };
}

test('advisories below high are never blocking', () => {
  const payload = auditPayload({
    semver: advisory('moderate', ['abc']),
    lodash: advisory('low', ['def']),
  });
  assert.deepEqual(blockingAdvisories(payload), []);
});

test('high and critical advisories are blocking and carry their GHSA ids', () => {
  const payload = auditPayload({
    mongoose: advisory('critical', ['vg7j-7cwx-8wgw']),
    ws: advisory('high', ['aaaa-bbbb-cccc']),
  });
  const blocking = blockingAdvisories(payload);
  assert.equal(blocking.length, 2);
  assert.ok(blocking[0].ghsas.includes('GHSA-vg7j-7cwx-8wgw'));
});

test('an allowlisted advisory passes while an unlisted one fails', () => {
  const allowlist = { 'GHSA-vg7j-7cwx-8wgw': 'tracked by the mongoose migration' };
  const payload = auditPayload({
    mongoose: advisory('critical', ['vg7j-7cwx-8wgw']),
    other: advisory('high', ['dddd-eeee-ffff']),
  });
  const { unlisted, stale } = evaluate(payload, allowlist);
  assert.deepEqual(unlisted, ['other (high) GHSA-dddd-eeee-ffff']);
  assert.deepEqual(stale, []);
});

test('a stale allowlist entry is reported so the list shrinks with the fixes', () => {
  const allowlist = {
    'GHSA-vg7j-7cwx-8wgw': 'mongoose migration',
    'GHSA-zzzz-yyyy-xxxx': 'already fixed somewhere',
  };
  const payload = auditPayload({
    mongoose: advisory('critical', ['vg7j-7cwx-8wgw']),
  });
  const { unlisted, stale } = evaluate(payload, allowlist);
  assert.deepEqual(unlisted, []);
  assert.deepEqual(stale, ['ghsa-zzzz-yyyy-xxxx']);
});

test('an advisory with no GHSA source cannot be allowlisted away', () => {
  // A direct dependency range can report a via entry that is a plain string
  // (a transitive chain description); it carries no id to list, so it blocks.
  const allowlist = {};
  const payload = auditPayload({
    mystery: { severity: 'critical', via: ['depends on vulnerable foo'] },
  });
  const { unlisted } = evaluate(payload, allowlist);
  assert.equal(unlisted.length, 1);
});

test('the shipped gate passes against the current production manifest', () => {
  // Runs npm audit for real — this is the assertion that keeps CI green.
  const allowlist = JSON.parse(fs.readFileSync(ALLOWLIST_PATH, 'utf8'));
  const { unlisted, stale } = evaluate(runAuditJson(), allowlist);
  assert.deepEqual(
    unlisted,
    [],
    'every production high/critical must be allowlisted with a reason'
  );
  assert.deepEqual(stale, [], 'no stale allowlist entries may remain');
});
