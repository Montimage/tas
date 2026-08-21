/**
 * Fixture server for the graceful-shutdown suite.
 *
 * A tiny HTTP server wired through the production shutdown module
 * (`src/server/shutdown.js`) with controllable response timing, so the tests
 * can hold a request in flight across a real SIGTERM/SIGINT without needing a
 * slow endpoint in the application itself or a live MongoDB.
 *
 * Environment:
 *   FIXTURE_SECOND_DELAY_MS  ms after the first partial byte before the
 *                            response ends (default 600)
 *   FIXTURE_HANG             when "1", /slow never completes its response
 *   FIXTURE_GRACE_MS         grace period handed to the shutdown module
 *
 * Prints `READY <port>` on stdout once it is listening; the closeDb stub logs
 * `[FIXTURE] database closed` on stderr so tests can prove the database step
 * ran before exit.
 */

var http = require('http');
var path = require('path');
var { installGracefulShutdown } = require(path.join(
  __dirname,
  '..',
  '..',
  'src',
  'server',
  'shutdown'
));

var secondDelay = Number(process.env.FIXTURE_SECOND_DELAY_MS) || 600;
var hang = process.env.FIXTURE_HANG === '1';
var gracePeriodMs = Number(process.env.FIXTURE_GRACE_MS);

var server = http.createServer(function (req, res) {
  if (req.url === '/slow') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.write('half');
    if (hang) {
      // The response is deliberately never finished: the socket stays active,
      // which is what a grace-period overrun looks like from the inside.
      return;
    }
    return setTimeout(function () {
      res.end('full');
    }, secondDelay);
  }
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('ok');
});

function closeDb(done) {
  process.stderr.write('[FIXTURE] database closed\n');
  done();
}

var options = { closeDb: closeDb };
if (gracePeriodMs) {
  options.gracePeriodMs = gracePeriodMs;
}
installGracefulShutdown(server, options);

server.listen(0, '127.0.0.1', function () {
  process.stdout.write(`READY ${server.address().port}\n`);
});
