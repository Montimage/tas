// watcher saga -> actions -> worker saga
import { call, put, takeEvery, select } from "redux-saga/effects";

import { requestLogs, requestLogFiles, requestDeleteLogFile } from "../api";
import { requestLogsOK, setNotification, requestLogFilesOK, selectLogFile } from "../actions";

const getTool = ({ tool }) => tool;
const getLogFile = ({ logs }) => logs.file;

function* handleRequestLogFiles() {
  try {
    const tool = yield select(getTool);
    const logFiles = yield call(() => requestLogFiles(tool));
    yield put(requestLogFilesOK(logFiles));
    // dispatch data
  } catch (error) {
    // dispatch error
    yield put(setNotification({ type: "error", message: error }));
  }
}

function* handleRequestLogs() {
  try {
    const tool = yield select(getTool);
    const logFile = yield select(getLogFile);
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
    const tool = yield select(getTool);
    const logFile = action.payload;
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
