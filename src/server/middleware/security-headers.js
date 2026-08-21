var crypto = require('crypto');
var fs = require('fs');
var path = require('path');
var helmet = require('helmet');

/**
 * The built dashboard that `app.js` serves statically. The policy below is
 * derived from what this bundle actually loads, so it is read from the same
 * place the server reads it from.
 */
var INDEX_HTML = path.join(__dirname, '..', '..', 'public', 'index.html');

/**
 * Collect the sha256 hashes of the inline `<script>` blocks in a served HTML
 * document, in the `'sha256-...'` form a Content Security Policy expects.
 *
 * The dashboard is a create-react-app build: its `index.html` carries the
 * webpack runtime inline, so a policy of `script-src 'self'` alone would block
 * the page from booting at all. Allowing `'unsafe-inline'` instead would give
 * back exactly the injected-script capability the policy exists to remove, so
 * the specific block that ships in the build is allow-listed by hash.
 *
 * The hashes are computed from the file at startup rather than pinned in
 * source, so rebuilding the client cannot silently leave a stale hash behind.
 *
 * @param {String} htmlPath Absolute path to the HTML document to scan
 * @returns {String[]} Quoted `sha256-...` source expressions, empty if unreadable
 */
function inlineScriptHashes(htmlPath) {
  var html;
  try {
    html = fs.readFileSync(htmlPath, 'utf8');
  } catch (_) {
    // No built client on disk (a source checkout that has not run a build).
    // The API still gets its policy; there is no inline script to allow.
    return [];
  }

  var hashes = [];
  var scriptTag = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  var match;

  while ((match = scriptTag.exec(html)) !== null) {
    // A script with a `src` loads an external file: covered by `'self'`, and
    // its (empty) body is not what the hash would have to match. The leading
    // boundary is a real space rather than `\b`, so a hyphenated attribute such
    // as `data-src` is not mistaken for the real one - that would drop a hash
    // the page needs and, once enforced, leave the dashboard blank.
    if (/(?:^|\s)src\s*=/i.test(match[1])) {
      continue;
    }
    var body = match[2];
    if (body.length === 0) {
      continue;
    }
    var digest = crypto.createHash('sha256').update(body, 'utf8').digest('base64');
    var source = "'sha256-" + digest + "'";
    if (hashes.indexOf(source) === -1) {
      hashes.push(source);
    }
  }

  return hashes;
}

/**
 * Build the Content Security Policy directives served with every response.
 *
 * Every directive is stated here rather than inherited from the middleware's
 * defaults, so the policy is auditable in one place and a dependency upgrade
 * cannot quietly widen or narrow it. Each choice below is derived from what the
 * shipped dashboard bundle under `src/public` actually loads.
 *
 * @param {Object} [options] Optional overrides
 * @param {String} [options.indexHtmlPath] HTML document to hash inline scripts from
 * @param {String} [options.reportUri] Endpoint to send violation reports to
 * @returns {Object} Directive map for the CSP middleware
 */
function buildCspDirectives(options) {
  var opts = options || {};
  var htmlPath = opts.indexHtmlPath || INDEX_HTML;

  var directives = {
    // Nothing loads from a third-party origin: the bundle references external
    // hosts only in comments, licence notices and XML namespaces.
    'default-src': ["'self'"],
    // A relative `<base>` injected into the page cannot repoint every other
    // relative URL at an attacker's host.
    'base-uri': ["'self'"],
    // No <object>/<embed>/<applet> anywhere in the dashboard.
    'object-src': ["'none'"],
    // The dashboard never frames anything.
    'frame-src': ["'none'"],
    // Keeps the X-Frame-Options: SAMEORIGIN guarantee in modern browsers.
    'frame-ancestors': ["'self'"],
    // The dashboard posts only to its own API.
    'form-action': ["'self'"],
    // `/static/js/*.chunk.js` plus the inline webpack runtime in index.html.
    'script-src': ["'self'"].concat(inlineScriptHashes(htmlPath)),
    // React attaches listeners through its synthetic event system, never as
    // inline `onclick=` attributes, so nothing legitimate needs these.
    'script-src-attr': ["'none'"],
    // `'unsafe-inline'` is required, not preferred: the component library
    // injects <style> elements at runtime and React writes inline `style`
    // attributes. Style injection is a far weaker primitive than script
    // injection, which stays hash-pinned above.
    'style-src': ["'self'", "'unsafe-inline'"],
    // The vendor CSS and JS chunks embed small icons as data: URIs.
    'img-src': ["'self'", 'data:'],
    // The build declares no @font-face, so no font is fetched at all.
    'font-src': ["'self'"],
    // Every API call in the bundle is a relative `/api/...` fetch. The MQTT and
    // STOMP brokers the dashboard configures are contacted by the server, not
    // by the browser, so no broker origin belongs here.
    'connect-src': ["'self'"],
    // The embedded JSON editor starts its Ace syntax worker from a blob URL.
    'worker-src': ["'self'", 'blob:'],
    // index.html links /manifest.json.
    'manifest-src': ["'self'"],
    'media-src': ["'self'"],
  };

  // Deliberately no `upgrade-insecure-requests`. It is part of the middleware's
  // default policy, but the documented deployment baseline serves the dashboard
  // over plain HTTP on loopback or behind a TLS-terminating proxy; upgrading
  // every subresource to https would break exactly that baseline.

  if (opts.reportUri) {
    directives['report-uri'] = [opts.reportUri];
  }

  return directives;
}

/**
 * The security-header middleware.
 *
 * Wraps helmet with an explicit Content Security Policy. Callers decide the
 * mode: `reportOnly: false` enforces the policy (the shipped default via
 * `config.cspReportOnly`), while leaving it on makes browsers report
 * violations without blocking - so a deployment whose dashboard build differs
 * from the shipped one can be observed before it is enforced.
 *
 * @param {Object} [options] Optional overrides
 * @param {Boolean} [options.reportOnly] Report violations instead of blocking
 * @param {String} [options.reportUri] Endpoint to send violation reports to
 * @param {String} [options.indexHtmlPath] HTML document to hash inline scripts from
 * @returns {Function} Express middleware
 */
function securityHeaders(options) {
  var opts = options || {};

  return helmet({
    contentSecurityPolicy: {
      // Declare the whole policy rather than merging into helmet's defaults.
      useDefaults: false,
      directives: buildCspDirectives(opts),
      reportOnly: opts.reportOnly !== false,
    },
  });
}

module.exports = {
  securityHeaders: securityHeaders,
  buildCspDirectives: buildCspDirectives,
  inlineScriptHashes: inlineScriptHashes,
  INDEX_HTML: INDEX_HTML,
};
