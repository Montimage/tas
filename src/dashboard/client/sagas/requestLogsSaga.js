// watcher saga -> actions -> worker saga
import {
  call,
  put,
  takeEvery
} from 'redux-saga/effects';

import {
  requestLogs
} from '../api';
import {
  requestLogsOK,
  setError
} from '../actions';

function* handleRequestLogs() {
  try {
    const logs = yield call(requestLogs);
    yield put(requestLogsOK(logs));
    // dispatch data
  } catch (error) {
    // dispatch error
    yield put(setError(error.toString()));
  }
}

function* watchRequestLogs() {
  yield takeEvery('REQUEST_LOGS', handleRequestLogs);
}

export default watchRequestLogs;
