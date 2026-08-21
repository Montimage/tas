const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO = path.join(__dirname, '..');
const readme = fs.readFileSync(path.join(REPO, 'README.md'), 'utf8');
const envExample = fs.readFileSync(path.join(REPO, 'env.example'), 'utf8');

/**
 * Extract the fenced code block carrying the quick-start `docker run`.
 * @param {String} markdown README content
 * @returns {String} The block's commands
 */
function quickStartBlock(markdown) {
  const blocks = [...markdown.matchAll(/```[a-z]*\n([\s\S]*?)```/g)].map((m) => m[1]);
  const block = blocks.find((b) => /docker run/.test(b));
  assert.ok(block, 'README should carry a quick-start docker run block');
  return block;
}

test('the documented docker run provisions a session secret', () => {
  const block = quickStartBlock(readme);
  assert.match(
    block,
    /-e\s+"?\$\{?SESSION_SECRET\}?=?|SESSION_SECRET=/,
    'the quick-start docker run must pass SESSION_SECRET'
  );
  // A literal placeholder would ship an identical secret in every deployment,
  // so the documented value has to be generated on the operator's machine.
  assert.match(
    block,
    /(openssl rand|\/dev\/urandom|pwgen)/,
    'the documented SESSION_SECRET must be generated, not a literal'
  );
});

test('the documented docker run provisions the administrator credential', () => {
  const block = quickStartBlock(readme);
  assert.match(
    block,
    /AUTH_ADMIN_PASSWORD_HASH=/,
    'the quick-start docker run must pass AUTH_ADMIN_PASSWORD_HASH'
  );
});

test('env.example documents SESSION_SECRET and AUTH_ADMIN_PASSWORD_HASH', () => {
  for (const key of ['SESSION_SECRET', 'AUTH_ADMIN_PASSWORD_HASH']) {
    assert.match(
      envExample,
      new RegExp(`^#?\\s*${key}=`, 'm'),
      `env.example should document ${key}`
    );
  }
});
