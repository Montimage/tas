import React from 'react';
import { createStore, applyMiddleware } from 'redux';
import createSagaMiddleware from 'redux-saga';
import { Provider } from 'react-redux';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// Same harness as App.test.js: real store + sagas, mocked api boundary.
const expiry = vi.hoisted(() => ({ handler: null }));

vi.mock('../api', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    requestSession: vi.fn(() => new Promise(() => {})),
    onSessionExpired: vi.fn((handler) => {
      expiry.handler = handler;
    }),
    sendRequestAllTestCases: vi.fn(() =>
      Promise.resolve([
        { id: 'case-1', name: 'First case' },
        { id: 'case-2', name: 'Second case' },
      ])
    ),
    sendRequestTestCase: vi.fn(() => Promise.resolve({})),
    sendRequestDeleteTestCase: vi.fn(() => Promise.resolve()),
    sendRequestAddNewTestCase: vi.fn(() => Promise.resolve('case-3')),
  };
});

import TestCaseListPage from './TestCaseListPage';
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
        <TestCaseListPage />
      </MemoryRouter>
    </Provider>
  );

describe('TestCaseListPage', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  test('asks for confirmation naming the test case before deleting it', async () => {
    const { sendRequestDeleteTestCase } = await import('../api');
    renderPage();
    await screen.findByText('First case');
    await userEvent.click(screen.getAllByRole('button', { name: /delete/i })[0]);
    expect(sendRequestDeleteTestCase).not.toHaveBeenCalled();
    expect(
      await screen.findByText(/delete test case "case-1"\?/i)
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() =>
      expect(sendRequestDeleteTestCase).toHaveBeenCalledWith('case-1')
    );
  });

  test('leaves the test case untouched when deletion is cancelled', async () => {
    const { sendRequestDeleteTestCase } = await import('../api');
    renderPage();
    await screen.findByText('First case');
    await userEvent.click(screen.getAllByRole('button', { name: /delete/i })[0]);
    await screen.findByText(/delete test case "case-1"\?/i);
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(sendRequestDeleteTestCase).not.toHaveBeenCalled();
    expect(screen.getByText('First case')).toBeInTheDocument();
  });

  test('shows a distinct empty state with a next action when there are no test cases', async () => {
    const { sendRequestAllTestCases } = await import('../api');
    sendRequestAllTestCases.mockResolvedValue([]);
    renderPage();
    expect(await screen.findByText(/no test cases yet/i)).toBeInTheDocument();
    expect(screen.queryByText('First case')).not.toBeInTheDocument();
  });

  test('shows an error state with a working retry when loading fails', async () => {
    const { sendRequestAllTestCases } = await import('../api');
    sendRequestAllTestCases.mockRejectedValueOnce(new Error('offline'));
    renderPage();
    expect(await screen.findByText(/failed to load/i)).toBeInTheDocument();
    sendRequestAllTestCases.mockResolvedValue([]);
    await userEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(await screen.findByText(/no test cases yet/i)).toBeInTheDocument();
    expect(sendRequestAllTestCases).toHaveBeenCalledTimes(2);
  });
});
