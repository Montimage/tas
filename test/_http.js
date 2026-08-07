const http = require("http");

/**
 * Make an HTTP request against a running server.
 *
 * When the server was started through `test/helpers/start-app.js` with a login
 * (the default), the session cookie and CSRF token it obtained are attached
 * automatically - so a suite written before the API was closed keeps working
 * unchanged. Pass `{ __anonymous: true }` in `headers` to send the request with
 * no credentials, which is what the authentication suites need.
 *
 * @param {http.Server} server The listening server
 * @param {String} method HTTP method
 * @param {String} path Request path (may contain URL-encoded sequences)
 * @param {Object} [body] Optional JSON body
 * @param {Object} [headers] Optional extra request headers
 * @returns {Promise<{status: Number, body: Object, raw: String, headers: Object}>}
 */
const request = (server, method, path, body, headers) =>
  new Promise((resolve, reject) => {
    const port = server.address().port;
    const data = body ? JSON.stringify(body) : null;
    const extra = Object.assign({}, headers);
    const anonymous = extra.__anonymous === true;
    delete extra.__anonymous;
    const auth = anonymous ? {} : server.__authHeaders || {};
    const options = {
      hostname: "127.0.0.1",
      port,
      path,
      method,
      headers: Object.assign({}, auth, extra),
    };
    if (data) options.headers["Content-Type"] = "application/json";
    const req = http.request(options, (res) => {
      let raw = "";
      res.on("data", (chunk) => {
        raw += chunk;
      });
      res.on("end", () => {
        let parsed = null;
        try {
          parsed = JSON.parse(raw);
        } catch (e) {
          /* not JSON */
        }
        resolve({ status: res.statusCode, body: parsed, raw, headers: res.headers });
      });
    });
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });

module.exports = { request };
