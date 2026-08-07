/**
 * The single administrator credential, provisioned from configuration.
 *
 * TaS is a single-tenant appliance: there is one operator account, and it is
 * bootstrapped from the environment rather than from a committed file, so a
 * checkout of this repository never carries a working credential and two
 * deployments never share one.
 *
 * Two forms are accepted. `AUTH_ADMIN_PASSWORD_HASH` is the preferred one — the
 * plaintext then only ever exists on the machine where the hash was generated.
 * `AUTH_ADMIN_PASSWORD` is the convenience form for a first start; it is hashed
 * once here and the plaintext is dropped on the floor immediately, so it is
 * never stored on the returned object, never logged and never comparable by a
 * later bug.
 *
 * "Dropped on the floor" is meant literally, and it extends to the caller's
 * configuration object: that object is held for the lifetime of the process and
 * passed to the middleware, the router and the cookie helpers, so a plaintext
 * left on it would be reachable from a heap dump, a debugger or a careless
 * `console.error(config)` long after it was needed. This function therefore
 * blanks the plaintext fields on the object it is handed, once it has hashed
 * them. It is the only consumer of those fields.
 */
const { hashPassword, verifyPassword, timingSafeCompare } = require("./passwords");

/**
 * A hash of a value nobody knows, used when no credential is configured.
 *
 * Verification still runs against it so an unconfigured deployment answers a
 * login attempt in the same time as a configured one — otherwise the response
 * time alone would tell an anonymous caller whether the server has a password
 * set at all.
 */
const UNCONFIGURED_HASH = hashPassword(require("crypto").randomBytes(32).toString("hex"));

/**
 * Blank a secret field on a configuration object, tolerating a frozen or
 * read-only object rather than failing startup over a defence-in-depth measure.
 *
 * @param {Object} target The object to scrub
 * @param {String} key The field to blank
 * @returns {void}
 */
function eraseSecret(target, key) {
  if (typeof target[key] !== "string" || target[key] === "") return;
  try {
    target[key] = "";
  } catch (_) {
    // Non-writable property: the value stays, and the hash is still what the
    // login route compares against.
  }
}

/**
 * Build the credential the login route verifies against.
 *
 * @param {Object} config The loaded server configuration
 * @returns {{configured: Boolean, username: String, source: String|null, verify: Function}}
 */
function createCredential(config) {
  const settings = config || {};
  const username = String(settings.authAdminUsername || "admin");

  let hash = null;
  let source = null;

  if (typeof settings.authAdminPasswordHash === "string" && settings.authAdminPasswordHash.trim() !== "") {
    hash = settings.authAdminPasswordHash.trim();
    source = "hash";
  } else if (typeof settings.authAdminPassword === "string" && settings.authAdminPassword !== "") {
    // Hashed once, here, and the plaintext goes out of scope with this branch.
    hash = hashPassword(settings.authAdminPassword);
    source = "password";
  }

  // Erase the plaintext from the caller's object now that it has been hashed.
  // Deliberately unconditional: whether the hash form won, the plaintext form
  // did, or neither was set, nothing downstream has any use for the plaintext.
  eraseSecret(settings, "authAdminPassword");
  eraseSecret(settings, "AUTH_ADMIN_PASSWORD");

  const configured = hash !== null;
  const stored = configured ? hash : UNCONFIGURED_HASH;

  return {
    configured: configured,
    username: username,
    source: source,
    /**
     * @param {String} offeredUsername Username from the login request
     * @param {String} offeredPassword Password from the login request
     * @returns {Boolean} True only when both match the configured credential
     */
    verify: function (offeredUsername, offeredPassword) {
      const nameMatches = timingSafeCompare(offeredUsername, username);
      // Deliberately unconditional: short-circuiting on the username would make
      // a wrong username measurably faster to reject than a wrong password,
      // which is a user-enumeration oracle even for a single-account system.
      const passwordMatches = verifyPassword(offeredPassword, stored);
      return configured && nameMatches && passwordMatches;
    },
  };
}

module.exports = { createCredential };
