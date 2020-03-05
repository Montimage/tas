// watcher saga -> actions -> worker saga
import {
  call,
  put,
  takeEvery,
  select
} from 'redux-saga/effects';

import {
  requestLogs
} from '../api';
import {
  requestLogsOK,
  setError
} from '../actions';

const getTool = ({ tool }) => tool;

function* handleRequestLogs() {
  try {
    const tool = yield select(getTool);
    const logs = yield call(() => requestLogs(tool));
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
