const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');

const REPO = `${__dirname}/..`;
const WORKFLOW_PATH = `${REPO}/.github/workflows/build-docker-container.yml`;
const rawWorkflow = fs.readFileSync(WORKFLOW_PATH, 'utf8');
// Executable content only — comments may document the old bug.
const workflow = rawWorkflow
  .split('\n')
  .map((l) => l.replace(/(^|\s)#.*$/, '$1'))
  .join('\n');

// The publish job must be gated on the test job.
test('publishing is gated on a passing test suite', () => {
  const lines = workflow.split('\n');
  const start = lines.findIndex((l) => l.trim() === 'publish:');
  assert.ok(start !== -1, 'workflow must define a publish job');
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^ {2}\S+:\s*$/.test(lines[i])) {
      end = i;
      break;
    }
  }
  const publish = lines.slice(start + 1, end).join('\n');
  assert.match(
    publish,
    /^ {4}needs:\s*test\s*$/m,
    'publish job must declare needs: test so a failing suite blocks the release'
  );
  assert.match(workflow, /run:\s*npm test/, 'the gate must run the full test suite');
});

// Issue #19: the old extraction was `tr -d 'refs/tags/'`, which deletes every
// occurrence of those characters instead of stripping the prefix.
test('version extraction strips the refs/tags/ prefix and never deletes characters', () => {
  assert.ok(!/tr -d/.test(workflow), 'character-deletion extraction must be gone');
  const line = workflow
    .split('\n')
    .find((l) => l.includes('PACKAGE_VERSION=') && l.includes('#refs/tags/'));
  assert.ok(line, 'extraction must use the ${GITHUB_REF#refs/tags/} prefix strip');

  // Behavioural check: run the exact expression from the workflow against
  // tags the old code mangled.
  const samples = [
    ['refs/tags/v1.0.2', 'v1.0.2'],
    ['refs/tags/v1.2.0-beta.1', 'v1.2.0-beta.1'],
    ['refs/tags/v3.0.0-greatest', 'v3.0.0-greatest'],
    ['refs/tags/v0.9.9-restfest-agate', 'v0.9.9-restfest-agate'],
  ];
  for (const [ref, expected] of samples) {
    const got = execFileSync('bash', ['-c', `${line.trim()}; echo "$PACKAGE_VERSION"`], {
      env: { ...process.env, GITHUB_REF: ref },
    })
      .toString()
      .trim();
    assert.strictEqual(got, expected, `${ref} must extract to ${expected}, got ${got}`);
  }
});

// Only stable vX.Y.Z releases may move the floating latest tag.
test('floating latest tag moves only for stable releases', () => {
  const m =
    workflow.match(/"\$PACKAGE_VERSION"=~(\/\^[^\s/]+\/)/) || workflow.match(/=~\s*(\^\S+)/);
  assert.ok(m, 'a stable-release regex must guard the latest tag');
  const stable = new RegExp(m[1].replace(/^\/\^/, '^').replace(/\/$/, ''), '');
  assert.match(stable.source, /\^v\\?\[\d/, 'regex must anchor on vX.Y.Z');
  for (const [version, expectStable] of [
    ['v1.0.2', true],
    ['v10.20.30', true],
    ['v1.2.0-beta.1', false],
    ['v2.0.0-rc.1', false],
    ['v3.0.0-greatest', false],
  ]) {
    assert.strictEqual(
      stable.test(version),
      expectStable,
      `${version} must ${expectStable ? '' : 'not '}count as stable`
    );
  }
  const latestStep = workflow.split('\n').findIndex((l) => l.trim() === '- name: Push latest tag');
  assert.ok(latestStep !== -1, 'latest push must be its own step');
  const stepBody = workflow
    .split('\n')
    .slice(latestStep, latestStep + 5)
    .join('\n');
  assert.match(stepBody, /if:.*IS_STABLE/, 'latest push must be guarded by IS_STABLE');
});

test('actions are pinned to current major versions, never floating or ancient refs', () => {
  const uses = [...workflow.matchAll(/^\s*uses:\s*(\S+)\s*$/gm)].map((m) => m[1]);
  assert.ok(uses.length >= 3, 'expected at least three action references');
  for (const ref of uses) {
    assert.doesNotMatch(ref, /@(v?[0-5]|master|main)$/, `${ref} is not a current pin`);
  }
  assert.ok(
    !uses.some((r) => r.startsWith('docker/build-push-action@')),
    'plain docker CLI is used for build/push'
  );
});

test('the built image is scanned for known vulnerabilities', () => {
  assert.match(workflow, /aquasecurity\/trivy-action@\d/, 'Trivy scan must run in the workflow');
  assert.match(
    workflow,
    /image-ref:\s*['"]?tas:release-scan/,
    'the scan must target the built image'
  );
});
