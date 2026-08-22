const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');

const REPO = `${__dirname}/..`;

// Executable content only — comments may document history or old behaviour.
const stripComments = (raw) =>
  raw
    .split('\n')
    .map((l) => l.replace(/(^|\s)#.*$/, '$1'))
    .join('\n');

const readWorkflow = (name) => fs.readFileSync(`${REPO}/.github/workflows/${name}`, 'utf8');

const ciWorkflow = stripComments(readWorkflow('e2e-security.yml'));
const ciLines = ciWorkflow.split('\n');

/** Slice the body of a top-level YAML key (lines up to the next unindented key). */
const topLevelBlock = (lines, key) => {
  const start = lines.findIndex((l) => l === `${key}:`);
  if (start === -1) return '';
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^\S/.test(lines[i])) {
      end = i;
      break;
    }
  }
  return lines.slice(start + 1, end).join('\n');
};

// --- Issue #24: lint and the full test suite run on every pull request -------

test('the CI gate workflow triggers on pull requests aimed at master', () => {
  const onBlock = topLevelBlock(ciLines, 'on');
  assert.match(onBlock, /^ {2}pull_request:\s*$/m, 'must declare a pull_request trigger');
  assert.match(
    onBlock,
    /^ {4}branches:\s*\['master'\]\s*$/m,
    'the pull_request trigger must target master'
  );
});

test('the same checks run on pushes to the default branch', () => {
  const onBlock = topLevelBlock(ciLines, 'on');
  assert.match(onBlock, /^ {2}push:\s*$/m, 'must declare a push trigger');
  // Both triggers must scope to master: exactly two branch pins, one per trigger.
  const pins = onBlock.match(/branches:\s*\['master'\]/g) || [];
  assert.ok(pins.length >= 2, 'both push and pull_request must target master');
});

test('lint runs on every pull request', () => {
  assert.match(ciWorkflow, /run:\s*npm run lint\s*$/m, 'the workflow must run eslint');
});

test('the full test suite runs on every pull request', () => {
  assert.match(ciWorkflow, /run:\s*npm test\s*$/m, 'the workflow must run the full suite');
});

// --- Issue #24 (AC5): dependabot proposals cover both manifests --------------

const dependabotPath = `${REPO}/.github/dependabot.yml`;
const dependabot = fs.readFileSync(dependabotPath, 'utf8');

test('dependabot is configured at schema version 2', () => {
  assert.match(dependabot, /^version:\s*['"]?2['"]?\s*$/m, 'dependabot.yml must set version: 2');
});

test('dependabot proposes npm updates for both manifests, weekly', () => {
  const dirs = [...dependabot.matchAll(/directory:\s*['"]?(\S+?)['"]?\s*$/gm)].map((m) => m[1]);
  assert.deepEqual(dirs.sort(), ['/', '/src/client'], 'both manifests must be covered');

  const ecosystems = [...dependabot.matchAll(/package-ecosystem:\s*['"]?(\S+?)['"]?\s*$/gm)].map(
    (m) => m[1]
  );
  assert.deepEqual(ecosystems, ['npm', 'npm'], 'each entry must target the npm ecosystem');

  const intervals = [...dependabot.matchAll(/interval:\s*['"]?(\S+?)['"]?\s*$/gm)].map((m) => m[1]);
  assert.deepEqual(intervals, ['weekly', 'weekly'], 'each manifest must be scanned weekly');
});

// --- Issue #24 (AC3): a failing check blocks the image publish ---------------
// The deep guards live in release-workflow.test.js; this records the parity
// invariant: what gates a PR is the same suite command that gates publishing.

test('the image publish is gated by the same suite command the PR gate runs', () => {
  const release = stripComments(readWorkflow('build-docker-container.yml'));
  assert.match(release, /^ {4}needs:\s*test\s*$/m, 'publish must need the test job');
  assert.match(release, /run:\s*npm test\s*$/m, 'the release gate must run the full suite');
});
