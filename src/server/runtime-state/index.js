'use strict';
/**
 * The runtime-state registry (issue #29).
 *
 * Which simulations, data recorders and test campaigns are running used to
 * live in module-level variables scattered across three route files. That
 * design lost every trace of running work on restart, kept stopped entries
 * around as placeholders that grew without bound, and assumed a single server
 * process forever.
 *
 * This module is now the ONE place that state lives. It owns two things:
 *
 *  - the run RECORDS, persisted to a JSON file so they survive a restart and
 *    can be observed by more than one server process sharing the same store;
 *  - the in-process HANDLES (the Simulation/DataRecorder/TestCampaign
 *    instances, their run loggers and start reservations), which cannot
 *    survive a process by nature and which only the owning process can call.
 *
 * Persistence is deliberately a JSON file rather than the database: the data
 * layer is configured lazily per request (#18) and may not exist yet when the
 * first run starts, and a dashboard asking "what is running" must be answerable
 * even when the database is down. The file is written atomically (temporary
 * file + rename) under an advisory lock file, so two processes mutating the
 * same store cannot clobber each other's entries. When the store cannot be
 * written the registry says so once and keeps working from memory - restart
 * survival is lost, the API is not.
 */

const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const DEFAULT_STORE_PATH = path.join(__dirname, '..', 'data', 'runtime-state.json');
const LOCK_RETRY_MS = 25;
const LOCK_TIMEOUT_MS = 5000;
const LOCK_STALE_MS = 10000;

// Kinds are the namespaces one shared store holds. Everything the routes track
// is listed here; an unknown kind is a programming error, not runtime data.
const KINDS = ['simulations', 'data-recorders', 'test-campaigns'];

let warnedStoreUnavailable = false;

/**
 * A stable identity for this process boot. A restarted server typically gets
 * a fresh pid that a stale record's pid may collide with, so liveness is
 * decided by the pair: a record whose owner pid equals ours but whose boot id
 * differs belonged to a predecessor and is not alive.
 */
const BOOT_ID = crypto.randomUUID();
const HOST_ID = os.hostname();

const storePath = () => process.env.TAS_RUNTIME_STATE_PATH || DEFAULT_STORE_PATH;
const lockPath = () => `${storePath()}.lock`;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Read the whole store. A missing file is an empty registry; an unparsable one
 * is quarantined (renamed beside the original) rather than trusted or deleted,
 * so what went wrong stays inspectable.
 */
async function readStore() {
  let raw;
  try {
    raw = await fsp.readFile(storePath(), 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') return {};
    throw err;
  }
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (_) {
    const quarantine = `${storePath()}.corrupt-${Date.now()}`;
    console.error(`[RUNTIME-STATE] Store is unparsable - quarantined to ${quarantine}`);
    try {
      await fsp.rename(storePath(), quarantine);
    } catch (_) {
      /* unreadable AND unmovable: start fresh rather than refuse to serve */
    }
    return {};
  }
}

/** Write the whole store atomically: temporary file in the same directory, then rename. */
async function writeStore(records) {
  const target = storePath();
  await fs.promises.mkdir(path.dirname(target), { recursive: true });
  const tmp = `${target}.${process.pid}.${Date.now()}.tmp`;
  await fsp.writeFile(tmp, JSON.stringify(records, null, 2));
  // The rename is atomic on POSIX: a concurrent reader sees either the old
  // file or the new one, never a half-written one.
  await fsp.rename(tmp, target);
}

/**
 * Run `mutate(records)` while holding the store's advisory lock.
 *
 * The lock is an O_EXCL create, retried until the timeout; a lock left behind
 * by a crashed process is stolen once it is older than LOCK_STALE_MS. On
 * timeout the mutation runs WITHOUT the lock rather than failing the request -
 * single-process correctness does not depend on it, and losing an occasional
 * cross-process update beats refusing to start work.
 */
async function withStoreLock(mutate) {
  const deadline = Date.now() + LOCK_TIMEOUT_MS;
  let fd = null;
  while (fd === null) {
    try {
      fd = await fsp.open(lockPath(), 'wx');
    } catch (err) {
      if (err.code !== 'EEXIST') break;
      if (Date.now() > deadline) break;
      try {
        const stat = await fsp.stat(lockPath());
        if (Date.now() - stat.mtimeMs > LOCK_STALE_MS) {
          // Nobody holding a healthy lock keeps it this long; the holder died.
          await fsp.unlink(lockPath()).catch(() => {});
        }
      } catch (_) {
        /* vanished already - just retry */
      }
      await sleep(LOCK_RETRY_MS);
    }
  }
  try {
    const records = await readStore();
    const next = await mutate(records);
    if (next !== undefined) await writeStore(next);
    return next;
  } finally {
    if (fd !== null) {
      await fd.close().catch(() => {});
      await fsp.unlink(lockPath()).catch(() => {});
    }
  }
}

/** Report - exactly once per process - that persistence degraded to memory-only. */
function warnStoreUnavailable(err) {
  if (warnedStoreUnavailable) return;
  warnedStoreUnavailable = true;
  console.error(
    `[RUNTIME-STATE] Persisting run state to ${storePath()} failed (${
      err && err.message ? err.message : err
    }) - continuing from memory only; running-work tracking will not survive a restart`
  );
}

/**
 * Is the process that owns a record still alive on this host?
 *
 * A foreign-host owner cannot be probed and is presumed alive (its record is
 * served as the view of what is running); everything else is answered by
 * signalling the pid, with the boot id catching pid reuse by a restarted
 * server.
 */
function ownerIsAlive(record) {
  const owner = record.owner || {};
  if (owner.host !== HOST_ID) return true;
  if (owner.pid === process.pid && owner.boot === BOOT_ID) return true;
  if (owner.pid === process.pid && owner.boot !== BOOT_ID) return false;
  try {
    process.kill(owner.pid, 0);
    return true;
  } catch (err) {
    return err.code === 'EPERM';
  }
}

/**
 * The handles only the owning process can use. Keyed `kind:id`, always paired
 * with a persisted record, and never exported beyond this module's own API.
 */
const handles = new Map();
/** Ids whose start is under way: released inside the storage callback, so two concurrent starts of one topology cannot both pass the guard. */
const reservations = new Map();
KINDS.forEach((kind) => reservations.set(kind, new Set()));

const handleKey = (kind, id) => `${kind}:${id}`;

module.exports = {
  KINDS,
  BOOT_ID,
  HOST_ID,
  ownerIsAlive,

  /**
   * Persist a new running record and remember its in-process handle.
   * @param {String} kind One of KINDS
   * @param {Object} record The record as the status surface reports it
   * @param {Object} [handle] The live run object / logger bundle, owning process only
   */
  async register(kind, record, handle) {
    const owned = {
      ...record,
      kind,
      status: 'running',
      owner: { pid: process.pid, boot: BOOT_ID, host: HOST_ID },
    };
    handles.set(handleKey(kind, record.id), { handle: handle || null, record: owned });
    try {
      await withStoreLock(async (records) => {
        records[kind] = records[kind] || {};
        records[kind][record.id] = owned;
        return records;
      });
    } catch (err) {
      warnStoreUnavailable(err);
    }
    return owned;
  },

  /**
   * Reserve a starting slot so the asynchronous default-storage path cannot
   * double-start one topology. Purely in-process by nature.
   */
  reserve(kind, id) {
    reservations.get(kind).add(id);
  },
  releaseReservation(kind, id) {
    reservations.get(kind).delete(id);
  },
  isReserved(kind, id) {
    return reservations.get(kind).has(id);
  },

  /** The live handle for an id, when this process owns the run. */
  getHandle(kind, id) {
    const entry = handles.get(handleKey(kind, id));
    return entry ? entry.handle : null;
  },

  /**
   * Every handle this process holds for a kind, as `{ id, handle }`. Only the
   * owning process has handles: a run another server process started is
   * visible through `list()` but has nothing to enumerate here.
   */
  ownHandles(kind) {
    const found = [];
    const prefix = `${kind}:`;
    for (const [key, entry] of handles.entries()) {
      if (key.startsWith(prefix)) {
        found.push({ id: key.slice(prefix.length), handle: entry.handle });
      }
    }
    return found;
  },

  /** The record this process registered for an id, if any. */
  getOwnRecord(kind, id) {
    const entry = handles.get(handleKey(kind, id));
    return entry ? entry.record : null;
  },

  /**
   * Every persisted record of a kind, read fresh from the shared store so a
   * second server process's registrations are visible here too.
   */
  async list(kind) {
    try {
      const records = await readStore();
      return Object.values(records[kind] || {});
    } catch (err) {
      warnStoreUnavailable(err);
      // Fall back to what this process knows it started.
      return [...handles.values()]
        .map((entry) => entry.record)
        .filter((record) => record.kind === kind);
    }
  },

  /**
   * Remove a record everywhere: from the shared store (so the registry does
   * not grow with stopped entries) and from this process's handle table.
   * Returns the last known record so the caller can report the final state.
   */
  async reap(kind, id) {
    const entry = handles.get(handleKey(kind, id));
    handles.delete(handleKey(kind, id));
    let removed = entry ? entry.record : null;
    try {
      await withStoreLock(async (records) => {
        if (records[kind] && records[kind][id]) {
          removed = records[kind][id];
          delete records[kind][id];
          return records;
        }
        // Nothing to remove: leave the store untouched on disk.
        return undefined;
      });
    } catch (err) {
      warnStoreUnavailable(err);
    }
    return removed;
  },

  /**
   * Reconcile the store with reality, called at boot and on each status poll:
   *
   *  - a record owned by a process that is gone is work orphaned by an
   *    unclean shutdown: it is reported (logged with its owner and start time,
   *    so the incident is detectable) and then reaped, because nothing can
   *    ever stop it again;
   *  - a record this process owns whose handle has finished on its own (a
   *    simulation whose devices all completed) is reaped the same way - the
   *    run ended, only the record was left.
   *
   * Records owned by other live processes are left alone: this process can
   * observe them but has no handle to stop them with.
   *
   * @param {String} kind One of KINDS
   * @param {Function} [isFinished] Predicate over a record, for handles this
   *   process owns; a true result reaps the record
   * @returns {Array} Every record the reconciliation removed - orphans and
   *   self-finished runs alike - so the caller can release their loggers
   */
  async reconcile(kind, isFinished) {
    const reaped = [];
    let changed = false;
    await withStoreLock(async (records) => {
      const mine = records[kind] || {};
      for (const id of Object.keys(mine)) {
        const record = mine[id];
        const isOwn =
          record.owner && record.owner.pid === process.pid && record.owner.boot === BOOT_ID;
        if (!ownerIsAlive(record)) {
          reaped.push({ ...record, orphaned: true });
          delete mine[id];
          changed = true;
          continue;
        }
        if (isOwn && typeof isFinished === 'function' && isFinished(record)) {
          reaped.push(record);
          delete mine[id];
          changed = true;
        }
      }
      // Nothing changed means nothing to persist: skipping the write keeps a
      // status poll from touching the disk on every dashboard refresh.
      return changed ? { ...records, [kind]: mine } : undefined;
    }).catch((err) => warnStoreUnavailable(err));
    for (const record of reaped) {
      if (record.orphaned) {
        console.error(
          `[RUNTIME-STATE] Orphaned ${kind} run "${record.name || record.id}" (owner pid ${
            record.owner && record.owner.pid
          }, started ${new Date(
            record.startedTime
          ).toISOString()}) was interrupted by an unclean shutdown - cleaning up`
        );
      }
      handles.delete(handleKey(kind, record.id));
    }
    return reaped;
  },

  /** Reconcile every kind. Used at boot, where no handle can be self-finished yet. */
  async reconcileAll() {
    const reaped = [];
    for (const kind of KINDS) {
      reaped.push(...(await module.exports.reconcile(kind)));
    }
    return reaped;
  },

  /**
   * Drop every record this process owns. Called on the graceful-shutdown path,
   * where the process takes its runs down with it deliberately: a clean
   * restart must not report ghosts, and what remains after an UNclean death
   * is exactly the orphan case reconcile knows how to clean.
   */
  async deregisterOwned() {
    const ownIds = [];
    for (const [key, entry] of handles.entries()) {
      if (entry.record.owner && entry.record.owner.boot === BOOT_ID) {
        // The kind prefix never contains the separator; the id may.
        const separator = key.indexOf(':');
        ownIds.push([key.slice(0, separator), key.slice(separator + 1)]);
      }
    }
    await withStoreLock(async (records) => {
      let changed = false;
      for (const [kind, id] of ownIds) {
        if (records[kind] && records[kind][id]) {
          delete records[kind][id];
          changed = true;
        }
      }
      return changed ? records : undefined;
    }).catch((err) => warnStoreUnavailable(err));
    handles.clear();
  },
};
