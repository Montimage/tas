// watcher saga -> actions -> worker saga
import {
  call,
  put,
  takeEvery
} from 'redux-saga/effects';

import {
  fetchLogs
} from '../api';
import {
  viewLogsOK,
  viewLogsFailed
} from '../actions';

function* handleSendViewLogs() {
  try {
    const logs = yield call(fetchLogs);
    yield put(viewLogsOK(logs));
    // dispatch data
  } catch (error) {
    // dispatch error
    yield put(viewLogsFailed(error.toString()));
  }
}

function* watchSendViewLogs() {
  yield takeEvery('SEND_VIEW_LOGS', handleSendViewLogs);
}

export default watchSendViewLogs;
