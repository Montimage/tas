import { describe, expect, test } from 'vitest';

import {
  requestAllModels,
  setAllModels,
  setNotification,
  requestDeleteModel,
} from '../actions';
import {
  requestAllLogFiles,
  requestAllLogFilesOK,
  requestDeleteLogFile,
  requestDeleteLogFileOK,
  requestLogFile,
} from '../actions';
import {
  requestLaunchTestCampaign,
  requestStopTestCampaign,
  setTestCampaignRunningStatus,
} from '../actions';
import {
  requestErrorReducer,
  requestingReducer,
} from './requestingSlice';

const dispatchAll = (reducer, actions) =>
  actions.reduce((state, action) => reducer(state, action), undefined);

describe('requestingReducer', () => {
  test('flips on for a list fetch and off when its data settles', () => {
    let state = requestingReducer(undefined, requestAllModels());
    expect(state).toBe(true);
    state = requestingReducer(state, setAllModels(['a.json']));
    expect(state).toBe(false);
  });

  test('tracks log file requests that were previously unregistered', () => {
    expect(requestingReducer(false, requestAllLogFiles('models'))).toBe(true);
    expect(requestingReducer(true, requestAllLogFilesOK([]))).toBe(false);
    expect(requestingReducer(false, requestDeleteLogFile({ tool: 't', logFile: 'f' }))).toBe(true);
    expect(requestingReducer(true, requestDeleteLogFileOK('f'))).toBe(false);
  });

  test('tracks campaign launch and stop as in-flight requests', () => {
    // Launch settles through its success notification (the status poll that
    // also reports running state is deliberately not tracked, so the flag
    // does not flicker on every 3s tick).
    let state = requestingReducer(false, requestLaunchTestCampaign());
    expect(state).toBe(true);
    state = requestingReducer(
      state,
      setNotification({ type: 'success', message: 'started' })
    );
    expect(state).toBe(false);
    expect(requestingReducer(false, requestStopTestCampaign())).toBe(true);
  });
});

describe('requestErrorReducer', () => {
  test('is null until a request fails', () => {
    expect(requestErrorReducer(undefined, { type: '@@INIT' })).toBeNull();
    const state = requestErrorReducer(
      null,
      setNotification({ type: 'error', message: 'boom' })
    );
    expect(state).toEqual({ message: 'boom' });
  });

  test('records an error message from any serializable value', () => {
    const err = new Error('network down');
    const state = requestErrorReducer(
      null,
      setNotification({ type: 'error', message: err })
    );
    expect(state.message).toBe(err);
  });

  test('a success notification does not clear or set the error', () => {
    const failure = requestErrorReducer(
      null,
      setNotification({ type: 'error', message: 'boom' })
    );
    expect(
      requestErrorReducer(failure, setNotification({ type: 'success', message: 'ok' }))
    ).toBe(failure);
    expect(requestErrorReducer(null, setNotification({ type: 'success', message: 'ok' }))).toBeNull();
  });

  test('any new request start clears the recorded failure (retry re-entry)', () => {
    const failure = requestErrorReducer(
      null,
      setNotification({ type: 'error', message: 'boom' })
    );
    expect(requestErrorReducer(failure, requestAllModels())).toBeNull();
    expect(requestErrorReducer(failure, requestDeleteModel('x.json'))).toBeNull();
  });

  test('the paired settle clears it but unrelated settles do not', () => {
    const failure = requestErrorReducer(
      null,
      setNotification({ type: 'error', message: 'boom' })
    );
    // A background simulation-status settle must not swallow the failure.
    expect(requestErrorReducer(failure, setTestCampaignRunningStatus({}))).toEqual(failure);
    // Its own resource settling replaces it with fresh data.
    expect(requestErrorReducer(failure, setAllModels([]))).toBeNull();
    // Log files have their own pair too.
    const logFailure = requestErrorReducer(
      null,
      setNotification({ type: 'error', message: 'logs boom' })
    );
    expect(requestErrorReducer(logFailure, requestAllLogFilesOK([]))).toBeNull();
    expect(requestErrorReducer(logFailure, requestLogFile({ tool: 't', logFile: 'f' }))).toBeNull();
  });
});
