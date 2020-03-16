// watcher saga -> actions -> worker saga
import { call, put, takeEvery, select } from "redux-saga/effects";

import { requestLogs, requestLogFiles } from "../api";
import { requestLogsOK, setNotification, requestLogFilesOK } from "../actions";

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

function* watchRequestLogs() {
  yield takeEvery('REQUEST_LOGS', handleRequestLogs);
  yield takeEvery("REQUEST_LOGFILES", handleRequestLogFiles);
}

export default watchRequestLogs;
