// watcher saga -> actions -> worker saga
import { call, put, takeEvery } from "redux-saga/effects";

import { sendRequestLogFile, sendRequestAllLogFiles, sendRequestDeleteLogFile } from "../api";
import { requestLogFileOK, setNotification, requestAllLogFilesOK, requestDeleteLogFileOK } from "../actions";

function* handleRequestAllLogFiles(action) {
  try {
    const tool = action.payload;
    const logFiles = yield call(() => sendRequestAllLogFiles(tool));
    yield put(requestAllLogFilesOK(logFiles));
    // dispatch data
  } catch (error) {
    // dispatch error
    yield put(setNotification({ type: "error", message: error }));
  }
}

function* handleRequestLogFile(action) {
  try {
    const {tool, logFile} = action.payload;
    const logs = yield call(() => sendRequestLogFile(tool, logFile));
    yield put(requestLogFileOK(logs));
    // dispatch data
  } catch (error) {
    // dispatch error
    yield put(setNotification({type: 'error', message: error}));
  }
}

function* handleRequestDeleteLogFile(action) {
  try {
    const {tool, logFile} = action.payload;
    yield call(() => sendRequestDeleteLogFile(tool, logFile));
    yield put(requestDeleteLogFileOK(logFile));
    // dispatch data
  } catch (error) {
    // dispatch error
    yield put(setNotification({type: 'error', message: error}));
  }
}

function* watchRequestLogs() {
  yield takeEvery('REQUEST_LOG_FILE', handleRequestLogFile);
  yield takeEvery("REQUEST_ALL_LOG_FILES", handleRequestAllLogFiles);
  yield takeEvery("REQUEST_DELETE_LOG_FILE", handleRequestDeleteLogFile);
}

export default watchRequestLogs;
