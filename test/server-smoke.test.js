var test = require('node:test');
var assert = require('node:assert');
var { startApp } = require('./helpers/start-app');

test('the server boots and serves the dashboard and the API without a .env file', async function () {
  var saved = ['SERVER_HOST', 'SERVER_PORT'].map(function (k) {
    var v = process.env[k];
    delete process.env[k];
    return [k, v];
  });
  var ctx = await startApp({});
  try {
    var dashboard = await fetch(ctx.base + '/');
    assert.strictEqual(dashboard.status, 200);
    assert.ok((await dashboard.text()).toLowerCase().indexOf('<!doctype html>') !== -1);

    var api = await fetch(ctx.base + '/api/devops/status');
    assert.strictEqual(api.status, 200);

    var staticAsset = await fetch(ctx.base + '/favicon.ico');
    assert.strictEqual(staticAsset.status, 200);
  } finally {
    ctx.server.close();
    ctx.restore();
    saved.forEach(function (pair) {
      if (pair[1] === undefined) {
        delete process.env[pair[0]];
      } else {
        process.env[pair[0]] = pair[1];
      }
    });
  }
});