// watcher saga -> actions -> worker saga
import {
  call,
  put,
  takeEvery,
} from 'redux-saga/effects';

import {
  sendRequestDevopts, sendRequestUpdateDevopts
} from '../api';
import {
  setNotification,
  setDevopts,
} from '../actions';

function* handleRequestDevopts() {
  try {
    const devopts = yield call(() => sendRequestDevopts());
    yield put(setDevopts(devopts));
    // dispatch data
  } catch (error) {
    // dispatch error
    yield put(setNotification({type: 'error', message: error}));
  }
}

function* handleRequestUpdateDevopts(action) {
  try {
    const newDevopts = action.payload;
    yield call(() => sendRequestUpdateDevopts(newDevopts));
    yield put(setDevopts(newDevopts));
    yield put(setNotification({type: 'success', message: `The dev Opts flow has been updated`}));
    // dispatch data
  } catch (error) {
    // dispatch error
    yield put(setNotification({type: 'error', message: error}));
  }
}

function* watchDevopts() {
  yield takeEvery('REQUEST_DEV_OPTS', handleRequestDevopts);
  yield takeEvery('REQUEST_UPDATE_DEV_OPTS', handleRequestUpdateDevopts);
}

export default watchDevopts;
