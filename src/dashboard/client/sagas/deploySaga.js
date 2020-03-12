// watcher saga -> actions -> worker saga
import {
  call,
  put,
  takeEvery,
  select
} from 'redux-saga/effects';

import {
  requestStartDeploy,
  requestStopDeploy
} from '../api';
import {
  deployStartOK,
  deployStopOK,
  setNotification
} from '../actions';

const getTool = ({tool}) => tool;

function* handleRequestStartDeploy() {
  try {
    const tool = yield select(getTool);
    const model = yield call(()=>requestStartDeploy(tool));
    yield put(deployStartOK());
    // dispatch data
  } catch (error) {
    // dispatch error
    yield put(setNotification({type: 'error', message: error}));
  }
}

function* handleRequestStopDeploy() {
  try {
    const tool = yield select(getTool);
    const model = yield call(()=>requestStopDeploy(tool));
    yield put(deployStopOK(model));
    // dispatch data
  } catch (error) {
    // dispatch error
    yield put(setNotification({type: 'error', message: error}));
  }
}

function* watchDeploy() {
  yield takeEvery('SEND_DEPLOY_START', handleRequestStartDeploy);
  yield takeEvery('SEND_DEPLOY_STOP', handleRequestStopDeploy);
}

export default watchDeploy;
