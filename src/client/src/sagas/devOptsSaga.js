// watcher saga -> actions -> worker saga
import {
  call,
  put,
  takeEvery,
} from 'redux-saga/effects';

import {
  sendRequestDevOpts, sendRequestUpdateDevOpts
} from '../api';
import {
  setNotification,
  setDevOpts,
} from '../actions';

function* handleRequestDevOpts() {
  try {
    const devOpts = yield call(() => sendRequestDevOpts());
    yield put(setDevOpts(devOpts));
    // dispatch data
  } catch (error) {
    // dispatch error
    yield put(setNotification({type: 'error', message: error}));
  }
}

function* handleRequestUpdateDevOpts(action) {
  try {
    const newDevOpts = action.payload;
    yield call(() => sendRequestUpdateDevOpts(newDevOpts));
    yield put(setDevOpts(newDevOpts));
    yield put(setNotification({type: 'success', message: `The dev Opts flow has been updated`}));
    // dispatch data
  } catch (error) {
    // dispatch error
    yield put(setNotification({type: 'error', message: error}));
  }
}

function* watchDevOpts() {
  yield takeEvery('REQUEST_DEV_OPTS', handleRequestDevOpts);
  yield takeEvery('REQUEST_UPDATE_DEV_OPTS', handleRequestUpdateDevOpts);
}

export default watchDevOpts;
