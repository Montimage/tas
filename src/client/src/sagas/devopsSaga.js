// watcher saga -> actions -> worker saga
import {
  call,
  put,
  takeEvery,
} from 'redux-saga/effects';

import {
  sendRequestDevops, sendRequestUpdateDevops
} from '../api';
import {
  setNotification,
  setDevops,
  requestDevops,
  requestUpdateDevops,
} from '../actions';

function* handleRequestDevops() {
  try {
    const devops = yield call(() => sendRequestDevops());
    yield put(setDevops(devops));
    // dispatch data
  } catch (error) {
    // dispatch error
    yield put(setNotification({type: 'error', message: error}));
  }
}

function* handleRequestUpdateDevops(action) {
  try {
    const newDevops = action.payload;
    yield call(() => sendRequestUpdateDevops(newDevops));
    yield put(setDevops(newDevops));
    yield put(setNotification({type: 'success', message: `The dev Opts flow has been updated`}));
    // dispatch data
  } catch (error) {
    // dispatch error
    yield put(setNotification({type: 'error', message: error}));
  }
}

function* watchDevops() {
  yield takeEvery(requestDevops, handleRequestDevops);
  yield takeEvery(requestUpdateDevops, handleRequestUpdateDevops);
}

export default watchDevops;
