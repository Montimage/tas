const http = require("http");

/**
 * Make an HTTP request against a running server.
 * @param {http.Server} server The listening server
 * @param {String} method HTTP method
 * @param {String} path Request path (may contain URL-encoded sequences)
 * @param {Object} [body] Optional JSON body
 * @returns {Promise<{status: Number, body: Object, raw: String}>}
 */
const request = (server, method, path, body) =>
  new Promise((resolve, reject) => {
    const port = server.address().port;
    const data = body ? JSON.stringify(body) : null;
    const options = {
      hostname: "127.0.0.1",
      port,
      path,
      method,
      headers: {},
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
        resolve({ status: res.statusCode, body: parsed, raw });
      });
    });
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });

module.exports = { request };
