// watcher saga -> actions -> worker saga
import { call, put, takeEvery } from "redux-saga/effects";

import {
  sendRequestAllReports,
  sendRequestReport,
  sendRequestDeleteReport,
  sendRequestUpdateReport,
  sendRequestEventsByDatasetId,
} from "../api";
import {
  setNotification,
  setCurrentReport,
  setAllReports,
  updateReportOK,
  deleteReportOK,
  setOriginalEvents,
  setNewEvents,
  setReportScore
} from "../actions";

function* handleRequestOriginalEvents(action) {
  try {
    const { datasetId, startTime, endTime, page } = action.payload;
    const { events } = yield call(() =>
      sendRequestEventsByDatasetId(datasetId, startTime, endTime, page)
    );
    yield put(setOriginalEvents(events));
    // dispatch data
  } catch (error) {
    // dispatch error
    yield put(
      setNotification({
        type: "error",
        message: error,
      })
    );
  }
}

function* handleRequestNewEvents(action) {
  try {
    const { datasetId, page } = action.payload;
    const { events } = yield call(() =>
      sendRequestEventsByDatasetId(datasetId, 0, Date.now(), page)
    );
    yield put(setNewEvents(events));
    // dispatch data
  } catch (error) {
    // dispatch error
    yield put(
      setNotification({
        type: "error",
        message: error,
      })
    );
  }
}

function* handleRequestReport(action) {
  try {
    const rpId = action.payload;
    const {report, score} = yield call(() => sendRequestReport(rpId));
    yield put(setCurrentReport(report));
    yield put(setReportScore(score));
    // dispatch data
  } catch (error) {
    // dispatch error
    yield put(
      setNotification({
        type: "error",
        message: error,
      })
    );
  }
}

function* handleRequestUpdateReport(action) {
  try {
    const { id, report } = action.payload;
    yield call(() => sendRequestUpdateReport(id, report));
    yield put(updateReportOK(report));
    yield put(
      setNotification({
        type: "success",
        message: `The report ${id} has been updated`,
      })
    );
    // dispatch data
  } catch (error) {
    // dispatch error
    yield put(
      setNotification({
        type: "error",
        message: error,
      })
    );
  }
}

function* handleRequestAllReports(action) {
  try {
    const options = action.payload;
    const allReports = yield call(() => sendRequestAllReports(options));
    yield put(setAllReports(allReports));
    // dispatch data
  } catch (error) {
    // dispatch error
    yield put(
      setNotification({
        type: "error",
        message: error,
      })
    );
  }
}

function* handleRequestDeleteReport(action) {
  try {
    const reportId = action.payload;
    yield call(() => sendRequestDeleteReport(reportId));
    yield put(deleteReportOK(reportId));
    yield put(
      setNotification({
        type: "success",
        message: `Report ${reportId} has been deleted`,
      })
    );
    // dispatch data
  } catch (error) {
    // dispatch error
    yield put(
      setNotification({
        type: "error",
        message: error,
      })
    );
  }
}

function* watchReports() {
  yield takeEvery("REQUEST_REPORT", handleRequestReport);
  yield takeEvery("REQUEST_ORIGINAL_EVENTS", handleRequestOriginalEvents);
  yield takeEvery("REQUEST_NEW_EVENTS", handleRequestNewEvents);
  yield takeEvery("REQUEST_UPDATE_REPORT", handleRequestUpdateReport);
  yield takeEvery("REQUEST_ALL_REPORTS", handleRequestAllReports);
  yield takeEvery("REQUEST_DELETE_REPORT", handleRequestDeleteReport);
}

export default watchReports;
