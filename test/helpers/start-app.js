var path = require('path');

function startApp(envOverrides, opts) {
  var host = (opts && opts.host) || '127.0.0.1';
  var appPath = path.join(__dirname, '..', '..', 'src', 'server', 'app.js');
  var configPath = path.join(__dirname, '..', '..', 'src', 'server', 'config.js');

  delete require.cache[require.resolve(configPath)];
  delete require.cache[require.resolve(appPath)];

  var saved = {};
  Object.keys(envOverrides || {}).forEach(function (key) {
    saved[key] = process.env[key];
    process.env[key] = envOverrides[key];
  });

  var app = require(appPath);

  function restore() {
    Object.keys(envOverrides || {}).forEach(function (key) {
      if (saved[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = saved[key];
      }
    });
  }

  return new Promise(function (resolve) {
    var server = app.listen(0, host, function () {
      var port = server.address().port;
      resolve({
        app: app,
        server: server,
        base: 'http://127.0.0.1:' + port,
        baseUrl: 'http://127.0.0.1:' + port,
        port: port,
        restore: restore
      });
    });
  });
}

module.exports = { startApp: startApp };