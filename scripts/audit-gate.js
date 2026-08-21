#!/usr/bin/env node
/**
 * CI dependency-advisory gate (issue #71).
 *
 * Runs `npm audit` over the production manifest and fails when any advisory
 * of severity HIGH or CRITICAL is present unless its GHSA id is explicitly
 * allowlisted in `.github/audit-allowlist.json`.
 *
 * The allowlist is deliberately a file, not a flag: every exception carries a
 * written reason naming the issue that owns the fix, and a stale entry — one
 * whose advisory no longer occurs — is also a failure, so the list cannot
 * silently accumulate. When issue #27 (Mongoose major migration) lands, the
 * three mongoose entries stop occurring, the gate goes red on the stale
 * entries themselves, and deleting them is the fix.
 *
 * Usage: node scripts/audit-gate.js [--audit-json <path>]
 *   --audit-json reads a captured `npm audit --json` payload instead of
 *   invoking npm (used by the tests; no network, no lockfile needed).
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ALLOWLIST_PATH = path.resolve(__dirname, '../.github/audit-allowlist.json');
const BLOCKING_SEVERITIES = new Set(['high', 'critical']);

function loadAllowlist(filePath) {
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (err) {
    fail(`cannot read the allowlist at .github/audit-allowlist.json: ${err.message}`);
  }
  for (const [id, entry] of Object.entries(parsed)) {
    if (!/^GHSA-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}$/i.test(id)) {
      fail(`allowlist key "${id}" is not a GHSA id`);
    }
    const reason = typeof entry === 'string' ? entry : entry && entry.reason;
    if (!reason || !reason.trim()) {
      fail(`allowlist entry "${id}" must carry a non-empty reason`);
    }
    if (typeof entry === 'object' && entry !== null && !('dies_with' in entry)) {
      // Optional, but when the object form is used the key set stays closed so
      // a typo like "die_with" cannot silently disable the stale-entry check.
      fail(`allowlist entry "${id}" has unknown keys — allowed: reason, dies_with`);
    }
  }
  return parsed;
}

/** Extract the blocking advisories from an `npm audit --json` payload. */
function blockingAdvisories(auditPayload) {
  const out = [];
  for (const [name, adv] of Object.entries(auditPayload.vulnerabilities || {})) {
    if (!BLOCKING_SEVERITIES.has(adv.severity)) continue;
    // npm reports via entries as objects whose `source` is a numeric advisory
    // id; the GHSA slug only appears in the `url`. Accept a literal GHSA
    // string too, so hand-built payloads in tests stay readable.
    const ghsas = (adv.via || [])
      .filter((v) => typeof v === 'object')
      .map((v) => {
        if (typeof v.url === 'string') {
          const m = v.url.match(/GHSA-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}/i);
          if (m) return m[0];
        }
        if (typeof v.source === 'string' && /^GHSA-/i.test(v.source)) {
          return v.source;
        }
        return null;
      })
      .filter(Boolean);
    out.push({ name, severity: adv.severity, ghsas, via: adv.via });
  }
  return out;
}

function evaluate(auditPayload, allowlist) {
  const blocking = blockingAdvisories(auditPayload);
  const listed = new Set(Object.keys(allowlist).map((k) => k.toLowerCase()));

  const unlisted = [];
  const seen = new Set();
  for (const adv of blocking) {
    for (const ghsa of adv.ghsas) seen.add(ghsa.toLowerCase());
    if (adv.ghsas.length === 0 || !adv.ghsas.some((g) => listed.has(g.toLowerCase()))) {
      unlisted.push(
        `${adv.name} (${adv.severity})${adv.ghsas.length ? ' ' + adv.ghsas.join(' ') : ''}`
      );
    }
  }

  // A stale entry means the fix landed: force its removal so the list shrinks.
  const stale = [...listed].filter((id) => !seen.has(id));

  return { blocking, unlisted, stale };
}

function fail(message) {
  console.error(`✗ audit-gate: ${message}`);
  process.exit(1);
}

/**
 * Run `npm audit --omit=dev --json` and return the parsed payload.
 *
 * npm exits non-zero whenever advisories exist — that is its report, not an
 * error — so the exit code is deliberately ignored and only a missing or
 * unparsable payload fails.
 */
function runAuditJson() {
  let raw;
  try {
    raw = execFileSync('npm', ['audit', '--omit=dev', '--json'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch (err) {
    raw = err.stdout;
  }
  try {
    return JSON.parse(raw);
  } catch (err) {
    fail(`npm audit produced no parsable report: ${err.message}`);
  }
}

function main() {
  const args = process.argv.slice(2);
  let jsonPath = null;
  const jsonIdx = args.indexOf('--audit-json');
  if (jsonIdx !== -1) jsonPath = args[jsonIdx + 1];

  const payload = jsonPath
    ? (() => {
        try {
          return JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
        } catch (err) {
          fail(`cannot read the captured audit payload: ${err.message}`);
        }
      })()
    : runAuditJson();

  const allowlist = loadAllowlist(ALLOWLIST_PATH);
  const { unlisted, stale } = evaluate(payload, allowlist);

  if (unlisted.length > 0) {
    console.error('✗ Unallowlisted production advisories at severity high or critical:');
    for (const line of unlisted) console.error(`    ● ${line}`);
    console.error('  Fix them or add an explicit allowlist entry with a reason in');
    console.error('  .github/audit-allowlist.json.');
  }
  if (stale.length > 0) {
    console.error('✗ Stale allowlist entries — their advisories no longer occur:');
    for (const id of stale) console.error(`    ● ${id} — remove the entry`);
  }
  if (unlisted.length > 0 || stale.length > 0) process.exit(1);

  console.log('✓ audit-gate: production manifest clean (or exceptions all justified)');
}

module.exports = { blockingAdvisories, evaluate, runAuditJson, ALLOWLIST_PATH };

if (require.main === module) {
  main();
}
