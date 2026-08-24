'use strict';
/**
 * The artifact store (issue #30).
 *
 * Topologies, data recorders and the service configuration used to be read and
 * rewritten as loose JSON files straight from the route handlers: a full-file
 * read-modify-write with no locking and no atomicity. Two concurrent edits
 * silently discarded one another, and a crash partway through a write could
 * leave a truncated file that no longer parsed - taking the stored record with
 * it.
 *
 * This module is the ONE place that I/O now goes through. Every record stays
 * its own file under the store's root directory (so existing records are
 * adopted in place on upgrade - there is nothing to migrate), but the writes
 * are serialized and atomic:
 *
 *  - every mutation runs while holding an advisory lock file (an O_EXCL
 *    create, retried until a timeout; a lock left behind by a crashed process
 *    is stolen once it is older than LOCK_STALE_MS), so two concurrent edits
 *    of the same record queue up instead of racing, and a mutation always
 *    applies to the state the previous one left behind;
 *  - every write lands first in a temporary file that is fsynced and then
 *    renamed over the target. The rename is atomic on POSIX: a concurrent
 *    reader sees either the old record or the new one, never a half-written
 *    one, and a crash during the write leaves the previous record intact with
 *    at worst an orphaned temporary file beside it;
 *  - a record that does not parse is quarantined (renamed beside the original)
 *    rather than served or silently deleted, so what went wrong stays
 *    inspectable.
 *
 * Like the runtime-state registry (#29), persistence degrades loudly rather
 * than taking the API down: an unwritable store fails exactly the request that
 * needed it, and nothing else.
 */

const fs = require('fs');
const fsp = fs.promises;
const path = require('path');

const LOCK_RETRY_MS = 25;
const LOCK_TIMEOUT_MS = 5000;
const LOCK_STALE_MS = 10000;

/** Extension every stored record carries; anything else in the root is not a record. */
const RECORD_EXTENSION = '.json';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Errors carry a stable `code` so route handlers can translate them into HTTP
 * responses without this module knowing about HTTP: EARTIFACTCONFLICT maps to
 * 409, EARTIFACTPATH to 400, and native ENOENT flows through the existing
 * `fileError` mapping to 404 untouched.
 */
const artifactError = (code, message) => {
  const err = new Error(message);
  err.code = code;
  return err;
};

/**
 * Contain a record name inside the store's root directory.
 *
 * Records are flat files, so anything carrying a separator, a traversal
 * sequence or an absolute path cannot name a record at all. Checked again at
 * this sink even though the request layer validates names first: the store is
 * also reachable from code paths that never saw the request schemas.
 *
 * @param {String} fileName The record file name, extension included
 * @returns {String} The resolved absolute path
 * @throws {Error} code EARTIFACTPATH when the name escapes the root
 */
const containedPath = (root, fileName) => {
  if (
    typeof fileName !== 'string' ||
    fileName.length === 0 ||
    fileName !== path.basename(fileName) ||
    !fileName.endsWith(RECORD_EXTENSION) ||
    fileName === '.' ||
    fileName === '..'
  ) {
    throw artifactError('EARTIFACTPATH', `Invalid record name: ${fileName}`);
  }
  return path.join(root, fileName);
};

/**
 * Create a store over one directory of JSON record files.
 *
 * @param {Object} options
 * @param {String} options.root Absolute path of the directory holding the records
 * @param {String} options.label Short name used for the lock file and log lines
 * @returns {Object} The store instance
 */
function createArtifactStore({ root, label }) {
  const absoluteRoot = path.resolve(root);
  const lockFile = path.join(absoluteRoot, `.${label}.lock`);

  /**
   * In-process fairness for the cross-process lock: concurrent callers queue
   * on this chain instead of hammering the O_EXCL retry loop against each
   * other. The chained promise swallows outcomes so one failed mutation never
   * stalls the ones queued behind it.
   */
  let mutexChain = Promise.resolve();

  /**
   * Run `mutate` while holding the advisory lock file.
   *
   * The lock is an O_EXCL create retried until the deadline; a lock left
   * behind by a crashed holder is stolen once it is older than
   * LOCK_STALE_MS. On timeout the mutation still runs, without the lock -
   * single-process correctness comes from the in-process chain, and losing an
   * occasional cross-process update beats refusing to serve.
   *
   * @param {Function} mutate Invoked with no arguments; its resolution is the outcome
   * @returns {Promise<*>} Whatever `mutate` resolved with
   */
  const withFileLock = async (mutate) => {
    await fsp.mkdir(absoluteRoot, { recursive: true });
    let fd = null;
    const deadline = Date.now() + LOCK_TIMEOUT_MS;
    while (fd === null) {
      try {
        fd = await fsp.open(lockFile, 'wx');
      } catch (err) {
        if (err.code !== 'EEXIST') break;
        if (Date.now() > deadline) break;
        try {
          const stat = await fsp.stat(lockFile);
          if (Date.now() - stat.mtimeMs > LOCK_STALE_MS) {
            // Nobody holding a healthy lock keeps it this long; the holder died.
            await fsp.unlink(lockFile).catch(() => {});
          }
        } catch (_) {
          /* vanished already - just retry */
        }
        await sleep(LOCK_RETRY_MS);
      }
    }
    try {
      return await mutate();
    } finally {
      if (fd !== null) {
        await fd.close().catch(() => {});
        await fsp.unlink(lockFile).catch(() => {});
      }
    }
  };

  /** Serialize a mutation through the in-process chain AND the file lock. */
  const exclusively = (mutate) => {
    const run = mutexChain.then(() => withFileLock(mutate));
    mutexChain = run.then(
      () => undefined,
      () => undefined
    );
    return run;
  };

  /**
   * Read and parse one record. A record that does not parse is quarantined
   * beside the original and reported as corrupt - it is never served, and
   * never quietly deleted.
   */
  const readRecord = async (target) => {
    const raw = await fsp.readFile(target, 'utf8');
    try {
      return JSON.parse(raw);
    } catch (_) {
      const quarantine = `${target}.corrupt-${Date.now()}`;
      console.error(
        `[${label}] Record is unparsable - quarantined to ${path.basename(quarantine)}`
      );
      await fsp.rename(target, quarantine).catch(() => {});
      throw artifactError(
        'EARTIFACTCORRUPT',
        'Stored record is unparsable and has been quarantined'
      );
    }
  };

  /**
   * Write one record atomically: temporary file in the same directory, fsync,
   * rename over the target. A crash at any point leaves either the old record
   * or the new one - never a truncated file - and every failure before the
   * rename cleans its temporary file up behind it.
   */
  const writeRecordAtomic = async (target, document) => {
    const tmp = `${target}.${process.pid}.${Date.now()}.tmp`;
    let handle = null;
    try {
      // Serialising can throw on its own (a document JSON cannot represent);
      // the cleanup below must cover that too, not just filesystem failures.
      const serialized = JSON.stringify(document, null, 2);
      handle = await fsp.open(tmp, 'wx');
      await handle.writeFile(serialized);
      // Durability before the rename: once the rename lands the record must
      // already be on disk, or a crash could swap in a name whose contents
      // were still in page cache.
      await handle.sync();
      await fsp.rename(tmp, target);
    } catch (err) {
      // Whatever failed - serialising, creating the temp file, writing,
      // syncing or the rename itself - the previous record is untouched; just
      // do not leave an orphaned temporary file behind.
      await fsp.unlink(tmp).catch(() => {});
      throw err;
    } finally {
      if (handle !== null) {
        await handle.close().catch(() => {});
      }
    }
  };

  const recordExists = async (target) => {
    try {
      await fsp.access(target);
      return true;
    } catch (err) {
      if (err.code === 'ENOENT') return false;
      throw err;
    }
  };

  return {
    /** The absolute root this store was created over. */
    root: absoluteRoot,

    /**
     * Every record file name in the store, sorted. Temporary and quarantined
     * artifacts of interrupted writes do not carry the bare `.json` suffix and
     * are never listed.
     *
     * @returns {Promise<String[]>} Record file names, extension included
     */
    async list() {
      await fsp.mkdir(absoluteRoot, { recursive: true });
      const entries = await fsp.readdir(absoluteRoot);
      return entries
        .filter((entry) => entry.endsWith(RECORD_EXTENSION))
        .filter((entry) => path.basename(entry) === entry)
        .sort();
    },

    /**
     * Read one record by file name.
     *
     * @param {String} fileName Record file name, extension included
     * @returns {Promise<Object>} The parsed record
     * @throws {Error} ENOENT-shaped when absent (maps to 404 upstream),
     *   EARTIFACTCORRUPT when unparsable, EARTIFACTPATH when the name escapes
     */
    async read(fileName) {
      return readRecord(containedPath(absoluteRoot, fileName));
    },

    /**
     * Does a record exist? Probes are only meaningful inside `withExclusive`,
     * where no mutation can land between the probe and the caller's own write.
     */
    async exists(fileName) {
      return recordExists(containedPath(absoluteRoot, fileName));
    },

    /**
     * Write a record. Refuses to replace an existing record unless asked,
     * which is how the create path earns its conflict answer.
     *
     * @param {String} fileName Record file name, extension included
     * @param {Object} document The record to persist
     * @param {Object} [options]
     * @param {Boolean} [options.overwrite] Replace an existing record (default false)
     * @throws {Error} EARTIFACTCONFLICT when the name is taken and overwrite was not set
     */
    async write(fileName, document, { overwrite = false } = {}) {
      return exclusively(async () => {
        const target = containedPath(absoluteRoot, fileName);
        if (!overwrite && (await recordExists(target))) {
          throw artifactError('EARTIFACTCONFLICT', `Record already exists: ${fileName}`);
        }
        return writeRecordAtomic(target, document);
      });
    },

    /**
     * Atomically move a record: the content is written under the new name and
     * the old name is removed, both inside one lock, so no observer can see
     * both copies or neither. With an optional transform applied on the way.
     *
     * @param {String} oldFileName Source record
     * @param {String} newFileName Target record
     * @param {Function} [transform] Invoked with the parsed source record
     * @returns {Promise<Object>} The record as written under the new name
     * @throws {Error} EARTIFACTCONFLICT when the target name is taken
     */
    async rename(oldFileName, newFileName, transform) {
      return exclusively(async () => {
        const source = containedPath(absoluteRoot, oldFileName);
        const target = containedPath(absoluteRoot, newFileName);
        if (source === target) {
          return readRecord(source);
        }
        const record = transform ? transform(await readRecord(source)) : await readRecord(source);
        if (await recordExists(target)) {
          throw artifactError('EARTIFACTCONFLICT', `Record already exists: ${newFileName}`);
        }
        await writeRecordAtomic(target, record);
        await fsp.unlink(source).catch(() => {});
        return record;
      });
    },

    /**
     * Remove a record. Absence throws an ENOENT-shaped error so the caller's
     * existing missing-file mapping answers it.
     */
    async remove(fileName) {
      return exclusively(async () => {
        const target = containedPath(absoluteRoot, fileName);
        await fsp.unlink(target);
      });
    },

    /**
     * Run a composed mutation while holding the store's lock.
     *
     * For multi-step mutations (a duplicate that must search for a free name
     * and then claim it) whose steps must not interleave with any other
     * mutation of this store. The callback receives the store's UNLOCKED
     * primitives (`read`, `exists`, `writeRaw`, `remove`) - calling the locked
     * public methods from inside would deadlock on the in-process chain.
     *
     * @param {Function} mutate Invoked with the unlocked API
     * @returns {Promise<*>} Whatever `mutate` resolved with
     */
    async withExclusive(mutate) {
      return exclusively(async () =>
        mutate({
          read: (fileName) => readRecord(containedPath(absoluteRoot, fileName)),
          exists: (fileName) => recordExists(containedPath(absoluteRoot, fileName)),
          writeRaw: (fileName, document) =>
            writeRecordAtomic(containedPath(absoluteRoot, fileName), document),
          remove: (fileName) => fsp.unlink(containedPath(absoluteRoot, fileName)),
        })
      );
    },
  };
}

module.exports = { createArtifactStore };
