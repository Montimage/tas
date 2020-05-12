// watcher saga -> actions -> worker saga
import { call, put, takeEvery } from "redux-saga/effects";

import { requestStats } from "../api";
import { requestStatsOK, setNotification } from "../actions";

function* handleRequestStats(action) {
  try {
    const {isDG} = action.payload;
    const tool = isDG ? 'data-generator' : 'simulation';
    const stats = yield call(() => requestStats(tool));
    yield put(requestStatsOK(stats));
    // dispatch data
  } catch (error) {
    // dispatch error
    yield put(setNotification({type: 'error', message: error}));
  }
}

function* watchRequestStats() {
  yield takeEvery('REQUEST_STATS', handleRequestStats);
}

export default watchRequestStats;
