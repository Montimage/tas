// watcher saga -> actions -> worker saga
import {
  call,
  put,
  takeEvery
} from 'redux-saga/effects';

import {
  MODELS
} from '../constants';
import {
  fetchModel
} from '../api';
import {
  setModel,
  setError
} from '../actions';

function* handleModelLoad() {
  try {
    const model = yield call(fetchModel);
    yield put(setModel(model));
    // dispatch data
  } catch (error) {
    // dispatch error
    yield put(setError(error.toString()));
  }
}

function* watchModelLoad() {
  yield takeEvery(MODELS.LOAD, handleModelLoad);
}

export default watchModelLoad;
