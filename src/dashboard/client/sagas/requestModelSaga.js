// watcher saga -> actions -> worker saga
import {
  call,
  put,
  takeEvery
} from 'redux-saga/effects';

import {
  requestModel
} from '../api';
import {
  setModel,
  setError
} from '../actions';

function* handleRequestModel() {
  try {
    const model = yield call(requestModel);
    yield put(setModel(model));
    // dispatch data
  } catch (error) {
    // dispatch error
    yield put(setError(error.toString()));
  }
}

function* watchRequestModel() {
  yield takeEvery('REQUEST_MODEL', handleRequestModel);
}

export default watchRequestModel;
