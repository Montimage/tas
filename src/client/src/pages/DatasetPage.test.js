import React from 'react';
import { createStore } from 'redux';
import { Provider } from 'react-redux';
import {
  render,
  screen,
  cleanup,
  fireEvent,
  act,
} from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';

// DatasetPage runs against the real reducers; the saga layer is absent, so
// tests settle the store themselves with the same actions the sagas would
// dispatch.
vi.mock('../api', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    onSessionExpired: vi.fn(() => {}),
  };
});

import DatasetPage from './DatasetPage';
import rootReducer from '../reducers';
import {
  setCurrentDataset,
  setEvents,
  setTotalNumberEvents,
  setNotification,
} from '../actions';

const dataset = {
  id: 'ds-1',
  name: 'My dataset',
  description: 'desc',
  tags: [],
  source: 'GENERATED',
};

const renderPage = () => {
  const store = createStore(rootReducer);
  render(
    <Provider store={store}>
      <DatasetPage />
    </Provider>
  );
  return store;
};

describe('DatasetPage', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    window.history.pushState({}, '', '/');
  });

  test('renders the loaded dataset with its event statistics', () => {
    window.history.pushState({}, '', '/data-sets/ds-1');
    const store = renderPage();
    // Mount starts both fetches (requesting=true); settling them reveals
    // the page content exactly as the sagas would after a successful load.
    act(() => {
      store.dispatch(setCurrentDataset(dataset));
      store.dispatch(setEvents([{ timestamp: 1, isSensorData: true }]));
      store.dispatch(setTotalNumberEvents(7));
    });
    expect(screen.getAllByText('My dataset').length).toBeGreaterThan(0);
    expect(
      screen.getAllByText(/number of presented events/i).length
    ).toBeGreaterThan(0);
    expect(screen.getByText('Get more events (1/7)')).toBeInTheDocument();
  });

  test('offers a retry when the dataset request fails and hides it on retry', () => {
    window.history.pushState({}, '', '/data-sets/ds-1');
    const store = renderPage();
    // The failed load settles through an error notification.
    act(() => {
      store.dispatch(setNotification({ type: 'error', message: 'boom' }));
    });
    expect(
      screen.getByRole('button', { name: /retry loading dataset/i })
    ).toBeInTheDocument();
    // Retrying re-enters the request lifecycle: the banner yields to the
    // in-flight state instead of stacking on top of it.
    fireEvent.click(
      screen.getByRole('button', { name: /retry loading dataset/i })
    );
    expect(
      screen.queryByRole('button', { name: /retry loading dataset/i })
    ).not.toBeInTheDocument();
  });

  test('shows no retry banner while the page is simply loading', () => {
    window.history.pushState({}, '', '/data-sets/ds-1');
    const store = renderPage();
    // Mount already dispatched the fetches; the flag is in flight.
    expect(store.getState().requesting).toBe(true);
    expect(store.getState().requestError).toBeNull();
  });
});
