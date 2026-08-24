import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import describeError from './describeError';

describe('describeError', () => {
  let consoleError;

  beforeEach(() => {
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  test('passes a readable string through untouched', () => {
    expect(describeError('Invalid credentials')).toBe('Invalid credentials');
    // A plain string is already display-ready; nothing is logged.
    expect(consoleError).not.toHaveBeenCalled();
  });

  test('uses the message of a thrown Error instead of "{}"', () => {
    expect(describeError(new Error('Undefined model'))).toBe('Undefined model');
    expect(describeError(new TypeError('Failed to fetch'))).toBe(
      'Failed to fetch'
    );
  });

  test('never renders an error stack or its constructor noise', () => {
    const err = new Error('boom');
    const shown = describeError(err);
    expect(shown).not.toMatch(/at .+/);
    expect(shown).not.toContain('Error:');
    expect(shown).toBe('boom');
  });

  test('reads the message field of a server-style error object', () => {
    expect(describeError({ error: 'Topology not found' })).toBe(
      'Topology not found'
    );
    expect(describeError({ message: 'Request failed (HTTP 409)' })).toBe(
      'Request failed (HTTP 409)'
    );
  });

  test('falls back to actionable text for unusable values', () => {
    for (const value of [undefined, null, {}, { error: 42 }, '', 7, ['a']]) {
      const shown = describeError(value);
      expect(typeof shown).toBe('string');
      expect(shown.length).toBeGreaterThan(0);
      // Says what to do next rather than showing "[object Object]".
      expect(shown).toMatch(/console/i);
      expect(shown).not.toContain('[object Object]');
    }
  });

  test('logs the raw value for developers when coercion was needed', () => {
    const raw = { code: 500 };
    describeError(raw);
    expect(consoleError).toHaveBeenCalledTimes(1);
    expect(consoleError.mock.calls[0][1]).toBe(raw);
  });
});
