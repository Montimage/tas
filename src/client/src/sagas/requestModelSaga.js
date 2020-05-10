// watcher saga -> actions -> worker saga
import {
  call,
  put,
  takeEvery,
  select
} from 'redux-saga/effects';

import {
  requestModel
} from '../api';
import {
  setModel,
  setNotification
} from '../actions';

function* handleRequestModel(action) {
  try {
    const tool = action.payload ? 'data-generator' : 'simulation';
    const model = yield call(() => requestModel(tool));
    yield put(setModel(model));
    // dispatch data
  } catch (error) {
    // dispatch error
    yield put(setNotification({type: 'error', message: error}));
  }
}

function* watchRequestModel() {
  yield takeEvery('REQUEST_MODEL', handleRequestModel);
}

export default watchRequestModel;
