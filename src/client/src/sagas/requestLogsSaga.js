// watcher saga -> actions -> worker saga
import { call, put, takeEvery } from "redux-saga/effects";

import { requestLogs, requestLogFiles, requestDeleteLogFile } from "../api";
import { requestLogsOK, setNotification, requestLogFilesOK } from "../actions";

function* handleRequestLogFiles(action) {
  try {
    const isDG = action.payload;
    const tool = isDG ? 'data-generator':'simulation';
    const logFiles = yield call(() => requestLogFiles(tool));
    yield put(requestLogFilesOK(logFiles));
    // dispatch data
  } catch (error) {
    // dispatch error
    yield put(setNotification({ type: "error", message: error }));
  }
}

function* handleRequestLogs(action) {
  try {
    const {isDG, logFile} = action.payload;
    const tool = isDG ? 'data-generator' : 'simulation';
    const logs = yield call(() => requestLogs(tool, logFile));
    yield put(requestLogsOK(logs));
    // dispatch data
  } catch (error) {
    // dispatch error
    yield put(setNotification({type: 'error', message: error}));
  }
}

function* handleRequestDeleteLogFile(action) {
  try {
    const {isDG, logFile} = action.payload;
    const tool = isDG ? 'data-generator' : 'simulation';
    yield call(() => requestDeleteLogFile(tool, logFile));
    // dispatch data
  } catch (error) {
    // dispatch error
    yield put(setNotification({type: 'error', message: error}));
  }
}

function* watchRequestLogs() {
  yield takeEvery('REQUEST_LOGS', handleRequestLogs);
  yield takeEvery("REQUEST_LOGFILES", handleRequestLogFiles);
  yield takeEvery("REQUEST_DELETE_LOG_FILE", handleRequestDeleteLogFile);
}

export default watchRequestLogs;
