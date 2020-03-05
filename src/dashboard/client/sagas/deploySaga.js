// watcher saga -> actions -> worker saga
import {
  call,
  put,
  takeEvery
} from 'redux-saga/effects';

import {
  requestStartDeploy,
  requestStopDeploy
} from '../api';
import {
  deployStartOK,
  deployStartFailed,
  deployStopOK,
  deployStopFailed
} from '../actions';

function* handleRequestStartDeploy() {
  try {
    const model = yield call(requestStartDeploy);
    yield put(deployStartOK());
    // dispatch data
  } catch (error) {
    // dispatch error
    yield put(deployStartFailed(error.toString()));
  }
}

function* handleRequestStopDeploy() {
  try {
    const model = yield call(requestStopDeploy);
    yield put(deployStopOK(model));
    // dispatch data
  } catch (error) {
    // dispatch error
    yield put(deployStopFailed(error.toString()));
  }
}

function* watchDeploy() {
  yield takeEvery('SEND_DEPLOY_START', handleRequestStartDeploy);
  yield takeEvery('SEND_DEPLOY_STOP', handleRequestStopDeploy);
}

export default watchDeploy;
