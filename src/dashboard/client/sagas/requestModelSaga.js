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
  setError
} from '../actions';

const getTool = ({ tool }) => tool;

function* handleRequestModel() {
  try {
    const tool = yield select(getTool);
    const model = yield call(() => requestModel(tool));
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
