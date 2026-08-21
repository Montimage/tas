/**
 * Graceful termination for the API server.
 *
 * On SIGTERM or SIGINT the server stops accepting new connections, lets the
 * requests already in flight finish, closes the database connection and then
 * exits 0. Without this, a restart under a process supervisor (`autorestart`)
 * or a `docker stop` severs in-flight responses mid-write and abandons the
 * Mongoose connection entirely. (F-BUG-010)
 *
 * The shutdown is bounded: a client that stalls forever must not hold the
 * process open past the grace period, so when it elapses the process exits 1
 * and lets the supervisor decide what happens next. Ten seconds matches the
 * docker stop default, so a container normally stops gracefully rather than
 * being killed by the daemon's follow-up SIGKILL.
 */

var SHUTDOWN_SIGNALS = ['SIGTERM', 'SIGINT'];
var DEFAULT_GRACE_PERIOD_MS = 10000;
var IDLE_CONNECTION_POLL_MS = 100;

/**
 * Wire signal handlers that shut `server` down gracefully.
 *
 * @param {net.Server} server The listening HTTP server
 * @param {Object} [options]
 * @param {Function} [options.closeDb] Called with a `done` callback once the
 *   HTTP connections have drained; the process exits after `done`. Defaults
 *   to a no-op for servers without a database connection.
 * @param {Number} [options.gracePeriodMs] How long in-flight work may take
 *   before the process forces its own exit with code 1 (default 10000).
 * @param {Console} [options.logger] Where progress is reported (default the
 *   global console).
 * @returns {Function} The shutdown routine, taking the signal name — exposed
 *   so tests can drive a drain without sending themselves a real signal.
 */
function installGracefulShutdown(server, options) {
  options = options || {};
  var closeDb =
    options.closeDb ||
    function (done) {
      done();
    };
  var gracePeriodMs =
    typeof options.gracePeriodMs === 'number' ? options.gracePeriodMs : DEFAULT_GRACE_PERIOD_MS;
  var logger = options.logger || console;
  var shuttingDown = false;

  function shutdown(signal) {
    // A second signal while draining must not start a second close sequence
    // on the same server — `server.close()` throws when called twice.
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;

    logger.log(
      `[SERVER] ${signal} received — stopping new connections, draining in-flight requests`
    );

    var forceExitTimer = setTimeout(function () {
      logger.error(
        `[SERVER] Grace period of ${gracePeriodMs}ms elapsed with connections still open — forcing exit`
      );
      process.exit(1);
    }, gracePeriodMs);
    // The timer is deliberately left running (unref'd, so it cannot hold the
    // event loop by itself): it bounds the whole shutdown, including the
    // database close, not just the HTTP drain. A clean run exits 0 long
    // before it can fire.
    forceExitTimer.unref();

    // `server.close()` stops the listener and fires its callback once every
    // connection has ended. Keep-alive sockets sitting idle at that moment —
    // and sockets that become idle as their responses finish — would hold the
    // callback open until the keep-alive timeout, so they are retired as soon
    // as they idle. Sockets with a request in flight are active and are left
    // alone to complete. Available since Node 18.2; the runtime here (node:22)
    // always has it, but the guard keeps the module honest on older runtimes.
    var retireIdleConnections = setInterval(function () {
      if (typeof server.closeIdleConnections === 'function') {
        server.closeIdleConnections();
      }
    }, IDLE_CONNECTION_POLL_MS);

    server.close(function () {
      clearInterval(retireIdleConnections);
      // A database layer that refuses to close must not turn a graceful
      // shutdown into a hang or an uncaught exception; report it and leave
      // through the same door as any other failed drain.
      try {
        closeDb(function () {
          logger.log('[SERVER] Shutdown complete');
          process.exit(0);
        });
      } catch (err) {
        logger.error(
          `[SERVER] Closing the database connection failed: ${err && err.stack ? err.stack : err}`
        );
        process.exit(1);
      }
    });
  }

  SHUTDOWN_SIGNALS.forEach(function (signal) {
    process.on(signal, function () {
      shutdown(signal);
    });
  });

  return shutdown;
}

module.exports = { installGracefulShutdown: installGracefulShutdown };
