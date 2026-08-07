/**
 * Password hashing and constant-time comparison.
 *
 * The administrator credential is the only secret the server verifies, so it is
 * stored the way a password store must be: never in plaintext, salted per
 * credential, and behind a deliberately slow key derivation. `scrypt` is used
 * because it ships in Node's own `crypto` module — a native add-on such as
 * bcrypt would have to be compiled inside the alpine image the Dockerfile
 * builds, which turns a hardening change into a build-system change.
 *
 * Every comparison in this file runs in constant time. A verifier that returns
 * as soon as two bytes differ leaks, through its response time, how much of a
 * guess was right, which is enough to reconstruct a secret one byte at a time.
 * `crypto.timingSafeEqual` refuses buffers of different lengths, so each caller
 * checks the length first and reports the mismatch as a plain "no" rather than
 * letting an exception escape into the request path.
 */
const crypto = require("crypto");

/** Serialised-form marker: this file only ever produces and reads scrypt hashes. */
const ALGORITHM = "scrypt";

/**
 * scrypt cost parameters. N=16384/r=8/p=1 is the interactive-login preset: it
 * costs a few tens of milliseconds per verification here and many machine-years
 * to brute-force a strong password offline. `maxmem` is raised above Node's
 * 32 MiB default because N*r*128 plus scrypt's own overhead sits just over it.
 */
const COST = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

/** Length of the random salt, in bytes. */
const SALT_BYTES = 16;

/** Length of the derived key, in bytes. */
const KEY_BYTES = 64;

/**
 * Compare two strings without revealing, through timing, where they differ.
 *
 * @param {String} a First value
 * @param {String} b Second value
 * @returns {Boolean} True when the two values are byte-for-byte identical
 */
function timingSafeCompare(a, b) {
  const left = Buffer.from(String(a === undefined || a === null ? "" : a), "utf8");
  const right = Buffer.from(String(b === undefined || b === null ? "" : b), "utf8");
  if (left.length !== right.length) {
    // Still do a comparison of equal-length buffers so a length mismatch is not
    // measurably cheaper than a content mismatch.
    crypto.timingSafeEqual(left, left);
    return false;
  }
  return crypto.timingSafeEqual(left, right);
}

/**
 * Hash a plaintext password into the serialised form this module verifies.
 *
 * The returned string carries the algorithm and the cost parameters alongside
 * the salt and the derived key, so a stored hash stays verifiable after the
 * defaults here are raised.
 *
 * @param {String} plain The plaintext password
 * @returns {String} `scrypt$N$r$p$<saltBase64>$<hashBase64>`
 */
function hashPassword(plain) {
  const salt = crypto.randomBytes(SALT_BYTES);
  const derived = crypto.scryptSync(String(plain), salt, KEY_BYTES, COST);
  return [
    ALGORITHM,
    COST.N,
    COST.r,
    COST.p,
    salt.toString("base64"),
    derived.toString("base64"),
  ].join("$");
}

/**
 * Verify a plaintext password against a serialised hash.
 *
 * Never throws: a malformed or truncated stored value is a configuration
 * mistake, and turning it into an exception inside the login path would answer
 * a wrong password with a 500 carrying a stack trace.
 *
 * @param {String} plain The plaintext password offered by the caller
 * @param {String} serialized The stored `scrypt$...` value
 * @returns {Boolean} True only when the password reproduces the stored key
 */
function verifyPassword(plain, serialized) {
  try {
    const parts = String(serialized || "").split("$");
    if (parts.length !== 6 || parts[0] !== ALGORITHM) return false;
    const N = Number(parts[1]);
    const r = Number(parts[2]);
    const p = Number(parts[3]);
    if (!Number.isInteger(N) || !Number.isInteger(r) || !Number.isInteger(p)) return false;
    if (N < 2 || r < 1 || p < 1) return false;
    const salt = Buffer.from(parts[4], "base64");
    const expected = Buffer.from(parts[5], "base64");
    if (salt.length === 0 || expected.length === 0) return false;
    const derived = crypto.scryptSync(String(plain), salt, expected.length, {
      N: N,
      r: r,
      p: p,
      maxmem: COST.maxmem,
    });
    if (derived.length !== expected.length) return false;
    return crypto.timingSafeEqual(derived, expected);
  } catch (_) {
    // A bad base64 payload, an unsupported cost, an out-of-memory scrypt: all
    // of them mean "this value does not verify", not "the server broke".
    return false;
  }
}

module.exports = {
  hashPassword,
  verifyPassword,
  timingSafeCompare,
};
