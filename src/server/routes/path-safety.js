const path = require('path');
const { ApiError, sendError } = require('../middleware/errors');

const NAME_MAX_LENGTH = 128;

// Allowlist of characters permitted in user-supplied names before they are
// used to derive a storage filename. Rejects path separators, control
// characters and any other value that could escape the intended directory.
const NAME_ALLOWLIST = /^[A-Za-z0-9][A-Za-z0-9 _\-.()[\]+@'#]*$/;

/**
 * Validate a user-supplied name against the allowlist and a length cap.
 * @param {String} name The name to validate
 * @returns {Boolean} true if the name may be used to derive a filename
 */
const isValidName = (name) => {
  return (
    typeof name === 'string' &&
    name.length > 0 &&
    name.length <= NAME_MAX_LENGTH &&
    NAME_ALLOWLIST.test(name) &&
    name !== '.' &&
    name !== '..'
  );
};

/**
 * Resolve a user-supplied relative path against a base directory and verify
 * the result stays inside the base directory. Handles traversal sequences
 * (including URL-encoded separators that are decoded before this runs).
 * @param {String} baseDir The intended base directory
 * @param {String} relativePath The user-supplied relative path
 * @returns {String|null} The resolved absolute path, or null if it escapes
 *                        the base directory
 */
const resolveWithin = (baseDir, relativePath) => {
  if (typeof relativePath !== 'string' || relativePath.length === 0) {
    return null;
  }
  const base = path.resolve(baseDir);
  const resolved = path.resolve(base, relativePath);
  const rel = path.relative(base, resolved);
  if (rel === '' || rel.startsWith('..') || path.isAbsolute(rel)) {
    return null;
  }
  return resolved;
};

/**
 * Reject a request with a 400-class status and a message that never
 * discloses server-side paths.
 *
 * The containment guards are handed a response object alone, with no `next` to
 * report through, so the refusal is routed to the central error handler
 * directly. It is still that handler that decides what the body looks like.
 */
const sendBadRequest = (res, message) => {
  return sendError(res, new ApiError(400, message || 'Invalid request'));
};

module.exports = {
  NAME_MAX_LENGTH,
  NAME_ALLOWLIST,
  isValidName,
  resolveWithin,
  sendBadRequest,
};
