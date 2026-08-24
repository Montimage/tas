import React from 'react';
import { createStore, applyMiddleware } from 'redux';
import createSagaMiddleware from 'redux-saga';
import { Provider } from 'react-redux';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, test, vi } from 'vitest';

// Same harness boundary as ModelListPage.test.js: the api layer is mocked so
// the real store + sagas run while the network stays out of scope.
vi.mock('../api', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    requestSession: vi.fn(() => new Promise(() => {})),
    onSessionExpired: vi.fn(() => {}),
    requestAllDataRecorders: vi.fn(() => Promise.resolve(['rec-a.json'])),
    requestDataRecorder: vi.fn(() => Promise.resolve({})),
    requestDeleteDataRecorder: vi.fn(() => Promise.resolve()),
    sendRequestDataRecorderStatus: vi.fn(() => Promise.resolve({})),
    sendRequestStopDataRecorder: vi.fn(() => Promise.resolve()),
    sendRequestStartDataRecorder: vi.fn(() => Promise.resolve({})),
  };
});

import DataRecorderListPage from './DataRecorderListPage';
import rootReducer from '../reducers';
import rootSaga from '../sagas';

const makeStore = () => {
  const sagaMiddleware = createSagaMiddleware();
  const store = createStore(rootReducer, applyMiddleware(sagaMiddleware));
  sagaMiddleware.run(rootSaga);
  return store;
};

const renderPage = () =>
  render(
    <Provider store={makeStore()}>
      <MemoryRouter>
        <DataRecorderListPage />
      </MemoryRouter>
    </Provider>
  );

describe('DataRecorderListPage accessibility (issue #39)', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  test('conveys recorder state by text, not colour alone', async () => {
    renderPage();
    await screen.findByText('rec-a');
    expect(screen.getByText('Stopped')).toBeInTheDocument();
  });

  test('keeps the file-import input reachable by keyboard and assistive tech', async () => {
    const { container } = renderPage();
    await screen.findByText('rec-a');
    const input = container.querySelector('input[type="file"]');
    expect(input).not.toBeNull();
    // A named control: assistive tech announces it instead of "unlabelled".
    expect(input).toHaveAttribute('aria-label', 'Import data recorder from file');
    // Not display:none — that would remove it from the tab order and the
    // accessibility tree entirely.
    expect(input.className).toContain('visually-hidden');
  });

  test('reports no critical or serious axe violations on the list page', async () => {
    const axe = (await import('axe-core')).default;
    const { container } = renderPage();
    await screen.findByText('rec-a');
    const results = await new Promise((resolve, reject) => {
      axe.run(container, { resultTypes: ['violations'] }, (err, res) =>
        err ? reject(err) : resolve(res)
      );
    });
    const blocking = results.violations.filter((v) =>
      ['critical', 'serious'].includes(v.impact)
    );
    expect(blocking.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });
});
