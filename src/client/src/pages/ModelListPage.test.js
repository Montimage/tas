import React from 'react';
import { createStore, applyMiddleware } from 'redux';
import createSagaMiddleware from 'redux-saga';
import { Provider } from 'react-redux';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// The api layer is the only boundary the dashboard talks to; mocking it lets
// the real store + sagas run while the network stays out of scope (the same
// harness App.test.js uses).
const expiry = vi.hoisted(() => ({ handler: null }));

vi.mock('../api', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    requestSession: vi.fn(() => new Promise(() => {})),
    onSessionExpired: vi.fn((handler) => {
      expiry.handler = handler;
    }),
    requestAllModels: vi.fn(() => Promise.resolve(['topo-a.json'])),
    requestModel: vi.fn(() => Promise.resolve({})),
    requestDeleteModel: vi.fn(() => Promise.resolve()),
    sendRequestSimulationStatus: vi.fn(() => Promise.resolve({})),
    sendRequestStopSimulation: vi.fn(() => Promise.resolve()),
  };
});

import ModelListPage from './ModelListPage';
import rootReducer from '../reducers';
import rootSaga from '../sagas';
import { setSimulationStatus } from '../actions';
import { getObjectId } from '../utils';

const makeStore = () => {
  const sagaMiddleware = createSagaMiddleware();
  const store = createStore(rootReducer, applyMiddleware(sagaMiddleware));
  sagaMiddleware.run(rootSaga);
  return store;
};

const renderPage = () =>
  render(
    <Provider store={makeStore()}>
      <ModelListPage />
    </Provider>
  );

describe('ModelListPage', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  test('asks for confirmation naming the topology before deleting it', async () => {
    const { requestDeleteModel } = await import('../api');
    renderPage();
    await screen.findByText('topo-a');
    await userEvent.click(screen.getByRole('button', { name: /delete/i }));
    // No removal until the user confirms.
    expect(requestDeleteModel).not.toHaveBeenCalled();
    // The confirmation names the specific item about to be removed.
    expect(await screen.findByText(/delete topology "topo-a\.json"/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(requestDeleteModel).toHaveBeenCalledWith('topo-a.json'));
  });

  test('leaves the topology untouched when the deletion is cancelled', async () => {
    const { requestDeleteModel } = await import('../api');
    renderPage();
    await screen.findByText('topo-a');
    await userEvent.click(screen.getByRole('button', { name: /delete/i }));
    await screen.findByText(/delete topology "topo-a\.json"/i);
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(requestDeleteModel).not.toHaveBeenCalled();
    // The row is still rendered.
    expect(screen.getByText('topo-a')).toBeInTheDocument();
  });

  test('confirms stopping a running simulation before stopping it', async () => {
    const { sendRequestStopSimulation } = await import('../api');
    const store = makeStore();
    render(
      <Provider store={store}>
        <ModelListPage />
      </Provider>
    );
    await screen.findByText('topo-a');
    store.dispatch(
      setSimulationStatus({ [getObjectId('topo-a')]: { isRunning: true } })
    );
    const stopButton = await screen.findByRole('button', { name: /stop/i });
    await userEvent.click(stopButton);
    expect(sendRequestStopSimulation).not.toHaveBeenCalled();
    expect(await screen.findByText(/stop.*simulation.*topo-a/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Stop' }));
    await waitFor(() =>
      expect(sendRequestStopSimulation).toHaveBeenCalledWith('topo-a.json')
    );
  });

  test('shows a distinct empty state with a next action when there are no topologies', async () => {
    const { requestAllModels } = await import('../api');
    requestAllModels.mockResolvedValue([]);
    renderPage();
    expect(await screen.findByText(/no topologies yet/i)).toBeInTheDocument();
    expect(screen.queryByText('topo-a')).not.toBeInTheDocument();
  });

  test('shows an error state with a working retry when loading fails', async () => {
    const { requestAllModels } = await import('../api');
    requestAllModels.mockRejectedValueOnce(new Error('boom'));
    renderPage();
    expect(await screen.findByText(/failed to load/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    // The retry re-issues the original request.
    requestAllModels.mockResolvedValue(['topo-a.json']);
    await userEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(await screen.findByText('topo-a')).toBeInTheDocument();
    expect(requestAllModels).toHaveBeenCalledTimes(2);
  });
});
