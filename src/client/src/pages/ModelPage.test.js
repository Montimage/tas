import React from 'react';
import { createStore, applyMiddleware } from 'redux';
import createSagaMiddleware from 'redux-saga';
import { Provider } from 'react-redux';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, test, vi } from 'vitest';

// The api layer is the only boundary the dashboard talks to; mocking it lets
// the real store + sagas run while the network stays out of scope (the same
// harness ModelListPage.test.js uses).
const expiry = vi.hoisted(() => ({ handler: null }));

vi.mock('../api', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    requestSession: vi.fn(() => new Promise(() => {})),
    onSessionExpired: vi.fn((handler) => {
      expiry.handler = handler;
    }),
    requestModel: vi.fn(() =>
      Promise.resolve({ name: 'topo-a.json', things: [] })
    ),
    requestDataStorage: vi.fn(() => Promise.resolve([])),
    sendRequestSimulationStatus: vi.fn(() => Promise.resolve({})),
    sendRequestStartSimulation: vi.fn(() => Promise.resolve({})),
  };
});

// The model editor pulls in brace/ace, which does not lay out under jsdom;
// the smoke tests below exercise the page header controls, not the editor.
vi.mock('../components/JSONView', () => ({
  default: () => <div data-testid="json-view" />,
}));
vi.mock('../components/SensorModal', () => ({ default: () => null }));
vi.mock('../components/ActuatorModal', () => ({ default: () => null }));
vi.mock('../components/ConnectionConfig', () => ({ default: () => null }));

import ModelPage from './ModelPage';
import rootReducer from '../reducers';
import rootSaga from '../sagas';

const renderPage = () => {
  const sagaMiddleware = createSagaMiddleware();
  const store = createStore(rootReducer, applyMiddleware(sagaMiddleware));
  sagaMiddleware.run(rootSaga);
  return render(
    <Provider store={store}>
      <MemoryRouter initialEntries={['/models/topo-a.json']}>
        <ModelPage />
      </MemoryRouter>
    </Provider>
  );
};

describe('ModelPage start simulation control (issue #36)', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    window.history.replaceState(null, '', '/');
  });

  test('renders a standalone Simulate button that starts the simulation', async () => {
    const { sendRequestStartSimulation } = await import('../api');
    // The page derives the topology name from the browser URL (BrowserRouter
    // keeps it current in production).
    window.history.replaceState(null, '', '/models/topo-a.json');
    renderPage();
    const simulate = await screen.findByRole('button', { name: /simulate/i });
    // No navigation anchor around it: starting and navigating are separate
    // actions.
    expect(simulate.closest('a')).toBeNull();
    await userEvent.click(simulate);
    await waitFor(() =>
      expect(sendRequestStartSimulation).toHaveBeenCalledWith(
        'topo-a.json',
        undefined,
        undefined
      )
    );
  });
});
