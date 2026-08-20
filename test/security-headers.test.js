const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const { startApp } = require('./helpers/start-app');
const { loadConfig } = require('../src/server/config');
const {
  buildCspDirectives,
  inlineScriptHashes,
  INDEX_HTML,
} = require('../src/server/middleware/security-headers');

const MISSING_ENV = path.join(__dirname, 'no-such-file.env');

/**
 * Fetch a path and return its status and response headers.
 * @param {String} base Server base URL
 * @param {String} target Request path
 * @returns {Promise<{status: Number, headers: Object}>} Response metadata
 */
function head(base, target) {
  return new Promise((resolve, reject) => {
    http
      .get(base + target, (res) => {
        res.resume();
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers }));
      })
      .on('error', reject);
  });
}

/**
 * Parse a CSP header value into a directive -> sources map.
 * @param {String} value Raw header value
 * @returns {Object} Directive map
 */
function parsePolicy(value) {
  const directives = {};
  for (const part of String(value).split(';')) {
    const tokens = part.trim().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) continue;
    directives[tokens[0]] = tokens.slice(1);
  }
  return directives;
}

/**
 * Run a block against a freshly started server with the given environment.
 * @param {Object} env Environment overrides
 * @param {Function} fn Receives the started context
 * @returns {Promise<void>} Resolves once the server is closed again
 */
async function withServer(env, fn) {
  const ctx = await startApp(env);
  try {
    await fn(ctx);
  } finally {
    await new Promise((resolve) => ctx.server.close(resolve));
    ctx.restore();
  }
}

test('a Content Security Policy is served on dashboard responses', async () => {
  await withServer({}, async (ctx) => {
    const dashboard = await head(ctx.base, '/');
    assert.equal(dashboard.status, 200);
    const value = dashboard.headers['content-security-policy-report-only'];
    assert.ok(value, 'the dashboard response should carry a CSP header');
    assert.match(value, /default-src 'self'/);

    // The API surface is covered by the same policy.
    const api = await head(ctx.base, '/api/models');
    assert.equal(
      api.headers['content-security-policy-report-only'],
      value,
      'API responses should carry the same policy'
    );
  });
});

test('the policy is declared explicitly, not inherited from middleware defaults', async () => {
  await withServer({}, async (ctx) => {
    const res = await head(ctx.base, '/');
    const policy = parsePolicy(res.headers['content-security-policy-report-only']);

    // Directives helmet's default policy does not contain at all: their
    // presence proves the policy is ours, not the shipped default.
    for (const directive of [
      'connect-src',
      'worker-src',
      'manifest-src',
      'frame-src',
      'media-src',
    ]) {
      assert.ok(policy[directive], `expected an explicit ${directive} directive`);
    }

    // Defaults we deliberately do not inherit.
    assert.ok(
      !('upgrade-insecure-requests' in policy),
      'upgrade-insecure-requests would break the documented plain-HTTP baseline'
    );
    assert.deepEqual(
      policy['font-src'],
      ["'self'"],
      'font-src should not keep the default https: data:'
    );
    assert.ok(
      !policy['style-src'].includes('https:'),
      'style-src should not keep the default https: source'
    );

    // Every directive the middleware emits is one we wrote down.
    const declared = Object.keys(buildCspDirectives());
    for (const directive of Object.keys(policy)) {
      assert.ok(declared.includes(directive), `undeclared directive in response: ${directive}`);
    }
  });
});

test('script execution is pinned rather than opened up with unsafe sources', async () => {
  await withServer({}, async (ctx) => {
    const res = await head(ctx.base, '/');
    const policy = parsePolicy(res.headers['content-security-policy-report-only']);

    assert.ok(!policy['script-src'].includes("'unsafe-inline'"));
    assert.ok(!policy['script-src'].includes("'unsafe-eval'"));
    assert.deepEqual(policy['object-src'], ["'none'"]);
    assert.deepEqual(policy['base-uri'], ["'self'"]);
    assert.deepEqual(policy['script-src-attr'], ["'none'"]);
  });
});

test('report-only mode is the default and can be switched to enforcing', async () => {
  await withServer({}, async (ctx) => {
    const res = await head(ctx.base, '/');
    assert.ok(
      res.headers['content-security-policy-report-only'],
      'the default rollout is report-only'
    );
    assert.equal(
      res.headers['content-security-policy'],
      undefined,
      'report-only mode must not also enforce'
    );
  });

  await withServer({ CSP_REPORT_ONLY: 'false' }, async (ctx) => {
    const res = await head(ctx.base, '/');
    assert.ok(res.headers['content-security-policy'], 'CSP_REPORT_ONLY=false enforces the policy');
    assert.equal(
      res.headers['content-security-policy-report-only'],
      undefined,
      'enforcing mode must not also report-only'
    );
    // Both positions serve the same policy - only the header name changes.
    assert.match(res.headers['content-security-policy'], /worker-src 'self' blob:/);
  });
});

test('a configured report endpoint is added to the policy', async () => {
  await withServer({ CSP_REPORT_URI: 'https://collector.example.com/csp' }, async (ctx) => {
    const res = await head(ctx.base, '/');
    const policy = parsePolicy(res.headers['content-security-policy-report-only']);
    assert.deepEqual(policy['report-uri'], ['https://collector.example.com/csp']);
  });
});

test('the served policy is exactly the one declared, source for source', async () => {
  // The directive *names* are checked above; this pins the sources too. Without
  // it, widening any directive to `*` - the regression the explicit policy
  // exists to prevent - passes every other test in this file.
  const inlineHashes = inlineScriptHashes(INDEX_HTML);
  const expected = {
    'default-src': ["'self'"],
    'base-uri': ["'self'"],
    'object-src': ["'none'"],
    'frame-src': ["'none'"],
    'frame-ancestors': ["'self'"],
    'form-action': ["'self'"],
    'script-src': ["'self'", ...inlineHashes],
    'script-src-attr': ["'none'"],
    'style-src': ["'self'", "'unsafe-inline'"],
    'img-src': ["'self'", 'data:'],
    'font-src': ["'self'"],
    'connect-src': ["'self'"],
    'worker-src': ["'self'", 'blob:'],
    'manifest-src': ["'self'"],
    'media-src': ["'self'"],
  };

  await withServer({}, async (ctx) => {
    const res = await head(ctx.base, '/');
    const policy = parsePolicy(res.headers['content-security-policy-report-only']);
    assert.deepEqual(policy, expected, 'the served policy drifted from the declared one');
  });
});

test('a report endpoint that cannot go into a header is rejected at startup', () => {
  // A newline survives `.trim()`, so without this check the server starts fine
  // and then answers every request with a 500 from inside the HTTP layer.
  for (const value of [
    'https://collector.example.com/csp\nX-Injected: 1',
    'https://collector.example.com /csp',
  ]) {
    process.env.CSP_REPORT_URI = value;
    try {
      assert.throws(
        () => loadConfig({ path: MISSING_ENV }),
        /CSP_REPORT_URI/,
        `${JSON.stringify(value)} should be refused by name at startup`
      );
    } finally {
      delete process.env.CSP_REPORT_URI;
    }
  }
});

test('a report endpoint that would inject directives is rejected by name', () => {
  process.env.CSP_REPORT_URI = 'https://collector.example.com/csp; script-src *';
  try {
    assert.throws(
      () => loadConfig({ path: MISSING_ENV }),
      /CSP_REPORT_URI/,
      'the error should name the setting at fault, not surface from the middleware'
    );
  } finally {
    delete process.env.CSP_REPORT_URI;
  }
});

test('CSP_REPORT_ONLY defaults to on and reads the usual off values', () => {
  assert.equal(loadConfig({ path: MISSING_ENV }).cspReportOnly, true);

  try {
    for (const value of ['false', 'FALSE', '0', 'no', 'off']) {
      process.env.CSP_REPORT_ONLY = value;
      assert.equal(
        loadConfig({ path: MISSING_ENV }).cspReportOnly,
        false,
        `"${value}" should disable`
      );
    }
    for (const value of ['true', '1', 'yes']) {
      process.env.CSP_REPORT_ONLY = value;
      assert.equal(
        loadConfig({ path: MISSING_ENV }).cspReportOnly,
        true,
        `"${value}" should enable`
      );
    }
  } finally {
    // Leaving this set would silently change the mode every later test observes.
    delete process.env.CSP_REPORT_ONLY;
  }
});

test('every inline script in the served dashboard is allow-listed by hash', () => {
  const html = fs.readFileSync(INDEX_HTML, 'utf8');
  const scriptSrc = buildCspDirectives()['script-src'];

  // Split on the closing tag rather than re-implementing the middleware's own
  // matcher: a duplicated regex would agree with the middleware even when both
  // are wrong, which is exactly the bug this test exists to catch.
  const inline = html
    .split('</script>')
    .slice(0, -1)
    .map((chunk) => chunk.slice(chunk.indexOf('<script')))
    .map((chunk) => ({
      attrs: chunk.slice(0, chunk.indexOf('>')),
      body: chunk.slice(chunk.indexOf('>') + 1),
    }))
    .filter((tag) => !/(?:^|\s)src\s*=/i.test(tag.attrs) && tag.body.length > 0);

  assert.ok(inline.length > 0, 'the built dashboard is expected to carry an inline runtime script');
  for (const tag of inline) {
    const digest = crypto.createHash('sha256').update(tag.body, 'utf8').digest('base64');
    assert.ok(
      scriptSrc.includes(`'sha256-${digest}'`),
      'an inline script in index.html is not covered by script-src'
    );
  }
  // Nothing but 'self' and those hashes: no stray source crept into script-src.
  assert.equal(scriptSrc.length, 1 + new Set(inline.map((tag) => tag.body)).size);
});

test('a script whose only src-like attribute is hyphenated is still hashed', () => {
  const fixture = path.join(
    fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'tas-csp-')),
    'index.html'
  );
  const body = 'window.__boot=1;';
  fs.writeFileSync(
    fixture,
    `<html><body><script data-src="ignored">${body}</script></body></html>`
  );

  const digest = crypto.createHash('sha256').update(body, 'utf8').digest('base64');
  assert.deepEqual(inlineScriptHashes(fixture), [`'sha256-${digest}'`]);

  fs.writeFileSync(fixture, '<html><body><script src="/a.js"></script></body></html>');
  assert.deepEqual(inlineScriptHashes(fixture), [], 'an external script contributes no hash');
});

test('every source the served dashboard references is same-origin', () => {
  const html = fs.readFileSync(INDEX_HTML, 'utf8');
  const references = [];

  const attr = /(?:src|href)\s*=\s*"([^"]+)"/gi;
  let match;
  while ((match = attr.exec(html)) !== null) {
    references.push(match[1]);
  }

  assert.ok(references.length > 0, 'index.html should reference at least one asset');
  for (const reference of references) {
    assert.ok(
      !/^(?:[a-z][a-z0-9+.-]*:)?\/\//i.test(reference),
      `${reference} is an absolute URL; 'self' would not permit it`
    );
  }
});

test('the header hardening that predates the CSP is still in place', async () => {
  await withServer({}, async (ctx) => {
    const res = await head(ctx.base, '/');
    assert.equal(res.headers['x-content-type-options'], 'nosniff');
    assert.equal(res.headers['x-frame-options'], 'SAMEORIGIN');
    assert.equal(res.headers['x-dns-prefetch-control'], 'off');
    assert.equal(res.headers['x-download-options'], 'noopen');
    assert.match(res.headers['strict-transport-security'], /max-age=\d+; includeSubDomains/);
    // The upgrade changes this from `1; mode=block` to `0` on purpose: the
    // legacy browser XSS auditor it re-enabled was itself exploitable, and the
    // CSP above is what replaces it. Asserted so the change stays deliberate.
    assert.equal(res.headers['x-xss-protection'], '0');
    assert.equal(res.headers['x-powered-by'], undefined, 'the server banner should stay hidden');
  });
});

test('the upgrade added the headers the previous major version never sent', async () => {
  await withServer({}, async (ctx) => {
    const res = await head(ctx.base, '/');
    assert.equal(res.headers['referrer-policy'], 'no-referrer');
    assert.equal(res.headers['x-permitted-cross-domain-policies'], 'none');
    assert.equal(res.headers['cross-origin-opener-policy'], 'same-origin');
    assert.equal(res.headers['cross-origin-resource-policy'], 'same-origin');
    assert.equal(res.headers['origin-agent-cluster'], '?1');
  });
});

test('the middleware degrades safely when no built client is on disk', () => {
  const hashes = inlineScriptHashes(path.join(__dirname, 'no-such-index.html'));
  assert.deepEqual(hashes, []);
  const directives = buildCspDirectives({
    indexHtmlPath: path.join(__dirname, 'no-such-index.html'),
  });
  assert.deepEqual(directives['script-src'], ["'self'"]);
});
