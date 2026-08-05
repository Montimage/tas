const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');

const REPO = `${__dirname}/..`;

function trackedFiles(subpath) {
  try {
    return execFileSync('git', ['ls-files', subpath], { cwd: REPO, encoding: 'utf8' }).trim();
  } catch (err) {
    return '';
  }
}

test('.env is not tracked by git', () => {
  assert.strictEqual(trackedFiles('.env'), '', '.env must not be tracked by git');
});

test('.env is listed in .gitignore', () => {
  const gitignore = fs.readFileSync(`${REPO}/.gitignore`, 'utf8');
  assert.ok(
    gitignore.split('\n').map((l) => l.trim()).includes('.env'),
    '.gitignore must ignore .env'
  );
});

test('env.example remains as the documented template', () => {
  const example = fs.readFileSync(`${REPO}/env.example`, 'utf8');
  assert.match(example, /SERVER_HOST/);
  assert.match(example, /SERVER_PORT/);
});