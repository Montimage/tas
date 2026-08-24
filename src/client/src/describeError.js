/**
 * Coerce any caught failure into a message a dashboard user can act on.
 *
 * Sagas and page handlers pass whatever landed in their `catch` straight to
 * setNotification, and the notification renderer used to push non-strings
 * through JSON.stringify - which turns an Error into the useless "{}"
 * (issue #40). This helper is the single coercion point every user-visible
 * failure goes through:
 *
 * - a readable string passes through untouched;
 * - an Error contributes its `.message`, never its `.stack` (a stack trace
 *   and the server filesystem paths it can contain must not reach the
 *   screen);
 * - an object shaped `{ error: "..." }` or `{ message: "..." }` contributes
 *   that field;
 * - anything else falls back to generic text that says what to do next.
 *
 * When the value was not already display-ready, the original is handed to
 * console.error so developers keep the technical detail users are spared.
 */
const FALLBACK_MESSAGE =
  'Something went wrong while completing your request. ' +
  'Check the browser console for technical details and try again.';

const firstNonEmptyString = (...candidates) =>
  candidates.find(
    (candidate) => typeof candidate === 'string' && candidate.trim() !== ''
  ) || null;

const describeError = (value) => {
  const asString = firstNonEmptyString(value);
  if (asString !== null) {
    return asString;
  }
  if (value instanceof Error) {
    // The stack belongs in the console only; the message is what a user can
    // read.
    console.error('[notification] failure detail:', value);
    return firstNonEmptyString(value.message) || FALLBACK_MESSAGE;
  }
  if (value !== null && typeof value === 'object') {
    const field = firstNonEmptyString(value.error, value.message);
    if (field !== null) {
      return field;
    }
  }
  console.error('[notification] failure detail:', value);
  return FALLBACK_MESSAGE;
};

export default describeError;
