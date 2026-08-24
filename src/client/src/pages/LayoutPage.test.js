import React from 'react';
import { createStore } from 'redux';
import { Provider } from 'react-redux';
import { render, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// Capture what LayoutPage hands to antd's notification without rendering a
// real one; every other antd export stays genuine.
const shown = [];
vi.mock('antd', async (importOriginal) => {
  const actual = await importOriginal();
  const capture = (kind) => vi.fn((config) => shown.push({ kind, config }));
  return {
    ...actual,
    notification: {
      ...actual.notification,
      success: capture('success'),
      error: capture('error'),
      warning: capture('warning'),
      info: capture('info'),
    },
  };
});

import LayoutPage from './LayoutPage';
import { setNotification } from '../actions';
import rootReducer from '../reducers';

const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

const renderWithNotification = (message) => {
  const store = createStore(rootReducer);
  // Dispatch before the first render: LayoutPage fires the antd notification
  // from render when a notification is in the store.
  store.dispatch(setNotification({ type: 'error', message }));
  return render(
    <Provider store={store}>
      <LayoutPage pageTitle="t">
        <div>content</div>
      </LayoutPage>
    </Provider>
  );
};

describe('LayoutPage notifications', () => {
  beforeEach(() => {
    shown.length = 0;
    consoleError.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  test('renders a thrown Error as its message instead of "{}"', () => {
    renderWithNotification(new Error('Undefined model'));
    expect(shown).toHaveLength(1);
    expect(shown[0].kind).toBe('error');
    expect(shown[0].config.description).toBe('Undefined model');
    // Developer detail survives in the console.
    expect(consoleError).toHaveBeenCalled();
  });

  test('renders a server-style error object as its readable field', () => {
    renderWithNotification({ error: 'Topology not found' });
    expect(shown).toHaveLength(1);
    expect(shown[0].config.description).toBe('Topology not found');
  });

  test('falls back to actionable text for unusable values', () => {
    renderWithNotification({ unrenderable: true });
    expect(shown).toHaveLength(1);
    const description = shown[0].config.description;
    expect(typeof description).toBe('string');
    expect(description).toMatch(/console/i);
    expect(description).not.toContain('[object Object]');
  });

  test('passes an already-readable string through untouched', () => {
    renderWithNotification('Invalid credentials');
    expect(shown).toHaveLength(1);
    expect(shown[0].config.description).toBe('Invalid credentials');
  });
});
