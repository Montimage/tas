var path = require('path');
var http = require('http');

/**
 * Credentials every in-process suite boots with.
 *
 * The API is closed by default (issue #9), so a suite that boots the real
 * application needs an account to reach it. These are injected only when the
 * caller has not said anything about them itself, so a test that wants an
 * unconfigured server (or a different password) still gets exactly what it
 * asked for.
 */
var TEST_CREDENTIALS = {
  AUTH_ADMIN_USERNAME: 'test-admin',
  AUTH_ADMIN_PASSWORD: 'test-password',
  SESSION_SECRET: 'test-session-secret',
};

/**
 * POST /api/auth/login against a listening server and collect the session.
 * @param {Number} port Bound port
 * @param {String} host Bound host
 * @param {Object} credentials {username, password}
 * @returns {Promise<{cookie: String, csrfToken: String, authHeaders: Object}>}
 */
function login(port, host, credentials) {
  return new Promise(function (resolve, reject) {
    var payload = JSON.stringify({
      username: credentials.username,
      password: credentials.password,
    });
    var req = http.request(
      {
        hostname: host,
        port: port,
        path: '/api/auth/login',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
      },
      function (res) {
        var raw = '';
        res.setEncoding('utf8');
        res.on('data', function (chunk) {
          raw += chunk;
        });
        res.on('end', function () {
          if (res.statusCode !== 200) {
            return reject(new Error('test login failed (' + res.statusCode + '): ' + raw));
          }
          var body = JSON.parse(raw);
          var cookie = (res.headers['set-cookie'] || [])
            .map(function (value) {
              return value.split(';')[0];
            })
            .join('; ');
          resolve({
            cookie: cookie,
            csrfToken: body.csrfToken,
            authHeaders: { Cookie: cookie, 'X-CSRF-Token': body.csrfToken },
          });
        });
      }
    );
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

/**
 * Boot the real application on an ephemeral port.
 *
 * @param {Object} [envOverrides] Environment values to apply for this instance
 * @param {Object} [opts]
 * @param {String} [opts.host] Address to bind (default 127.0.0.1)
 * @param {Boolean} [opts.login] Log in after booting (default true). Pass
 *   `false` for a suite that has to observe the anonymous behaviour.
 * @returns {Promise<Object>} The started context
 */
function startApp(envOverrides, opts) {
  var host = (opts && opts.host) || '127.0.0.1';
  var shouldLogin = !(opts && opts.login === false);
  var appPath = path.join(__dirname, '..', '..', 'src', 'server', 'app.js');
  var configPath = path.join(__dirname, '..', '..', 'src', 'server', 'config.js');

  delete require.cache[require.resolve(configPath)];
  delete require.cache[require.resolve(appPath)];

  var overrides = Object.assign({}, envOverrides);
  Object.keys(TEST_CREDENTIALS).forEach(function (key) {
    if (!(key in overrides)) {
      overrides[key] = TEST_CREDENTIALS[key];
    }
  });

  var saved = {};
  Object.keys(overrides).forEach(function (key) {
    saved[key] = process.env[key];
    process.env[key] = overrides[key];
  });

  var app = require(appPath);

  function restore() {
    Object.keys(overrides).forEach(function (key) {
      if (saved[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = saved[key];
      }
    });
  }

  return new Promise(function (resolve, reject) {
    var server = app.listen(0, host, function () {
      var port = server.address().port;
      var ctx = {
        app: app,
        server: server,
        base: 'http://127.0.0.1:' + port,
        baseUrl: 'http://127.0.0.1:' + port,
        port: port,
        restore: restore,
      };
      if (!shouldLogin) {
        return resolve(ctx);
      }
      login(port, '127.0.0.1', {
        username: overrides.AUTH_ADMIN_USERNAME,
        password: overrides.AUTH_ADMIN_PASSWORD,
      })
        .then(function (session) {
          ctx.cookie = session.cookie;
          ctx.csrfToken = session.csrfToken;
          ctx.authHeaders = session.authHeaders;
          // `test/_http.js` attaches these to every request it makes against
          // this server, so the suites that predate authentication keep working
          // unchanged rather than each growing a login preamble.
          server.__authHeaders = session.authHeaders;
          resolve(ctx);
        })
        .catch(function (err) {
          server.close();
          restore();
          reject(err);
        });
    });
  });
}

module.exports = { startApp: startApp, TEST_CREDENTIALS: TEST_CREDENTIALS };
