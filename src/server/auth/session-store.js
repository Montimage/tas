/**
 * The server-side session table.
 *
 * Sessions are held here, in the process, and the browser only ever carries an
 * opaque identifier. That is what makes a session revocable: a self-contained
 * token (a JWT, say) cannot be invalidated before it expires without a denylist,
 * which is this table under another name — and this deployment is a single
 * process, so the table is both tiny and authoritative.
 *
 * Expiry is two-sided on purpose. The idle timeout slides forward on every
 * request, so an operator working in the dashboard is never logged out mid-task
 * (that is the "no spurious logouts" requirement); the absolute timeout does not
 * slide, so a session cannot be kept alive indefinitely by traffic alone.
 *
 * Expired records are removed lazily, from `get` and `create`, rather than by a
 * timer: a `setInterval` would hold the event loop open and stop the process
 * (and every test suite that starts one) from exiting on its own.
 */
const crypto = require("crypto");

/** Default idle window: an operator session that goes quiet for an hour ends. */
const DEFAULT_IDLE_TTL_MS = 60 * 60 * 1000;

/** Default hard cap: no session outlives half a day, however busy it is. */
const DEFAULT_ABSOLUTE_TTL_MS = 12 * 60 * 60 * 1000;

/** Opaque, unguessable identifier — 256 bits from the system CSPRNG. */
const newId = () => crypto.randomBytes(32).toString("base64url");

/**
 * Create an in-process session store.
 *
 * @param {Object} [options]
 * @param {Number} [options.idleTtlMs] Sliding inactivity window
 * @param {Number} [options.absoluteTtlMs] Hard lifetime, measured from creation
 * @returns {Object} The store
 */
function createSessionStore(options) {
  const opts = options || {};
  const idleTtlMs = Number(opts.idleTtlMs) > 0 ? Number(opts.idleTtlMs) : DEFAULT_IDLE_TTL_MS;
  const absoluteTtlMs =
    Number(opts.absoluteTtlMs) > 0 ? Number(opts.absoluteTtlMs) : DEFAULT_ABSOLUTE_TTL_MS;

  const sessions = new Map();

  /**
   * @param {Object} session The stored record
   * @param {Number} now Current epoch milliseconds
   * @returns {Boolean} True when the record may no longer be used
   */
  const isExpired = (session, now) =>
    now - session.lastSeenAt > idleTtlMs || now - session.createdAt > absoluteTtlMs;

  /**
   * Drop every expired record. Cheap: the table holds one entry per live
   * operator session, which for a single-tenant appliance is a handful.
   * @returns {Number} How many records were removed
   */
  function sweep() {
    const now = Date.now();
    let removed = 0;
    for (const [id, session] of sessions) {
      if (isExpired(session, now)) {
        sessions.delete(id);
        removed += 1;
      }
    }
    return removed;
  }

  return {
    /**
     * @param {String} user The authenticated identity
     * @returns {Object} The new session record
     */
    create: function (user) {
      sweep();
      const now = Date.now();
      const session = {
        id: newId(),
        user: String(user),
        csrfToken: crypto.randomBytes(32).toString("base64url"),
        createdAt: now,
        lastSeenAt: now,
        expiresAt: now + absoluteTtlMs,
      };
      sessions.set(session.id, session);
      return session;
    },

    /**
     * @param {String} id Session identifier from the cookie
     * @returns {Object|null} The live record, or null when absent or expired
     */
    get: function (id) {
      if (typeof id !== "string" || id === "") return null;
      const session = sessions.get(id);
      if (!session) return null;
      if (isExpired(session, Date.now())) {
        sessions.delete(id);
        return null;
      }
      return session;
    },

    /**
     * Slide the inactivity window forward.
     * @param {String} id Session identifier
     * @returns {Object|null} The refreshed record, or null when it is gone
     */
    touch: function (id) {
      const session = this.get(id);
      if (!session) return null;
      session.lastSeenAt = Date.now();
      return session;
    },

    /**
     * @param {String} id Session identifier
     * @returns {Boolean} True when a record was removed
     */
    destroy: function (id) {
      if (typeof id !== "string") return false;
      return sessions.delete(id);
    },

    /** Invalidate every session at once. */
    destroyAll: function () {
      sessions.clear();
    },

    sweep: sweep,

    /** @returns {Number} How many records are held (expired ones included). */
    size: function () {
      return sessions.size;
    },
  };
}

module.exports = { createSessionStore, DEFAULT_IDLE_TTL_MS, DEFAULT_ABSOLUTE_TTL_MS };
