// watcher saga -> actions -> worker saga
import { call, put, takeEvery, select } from "redux-saga/effects";

import {
  requestStartDeploy,
  requestStopDeploy,
  requestDeployStatus
} from "../api";
import {
  deployStartOK,
  deployStopOK,
  setNotification,
  setDeployStatus
} from "../actions";

const getModel = ({ model }) => model;

function* handleRequestStartDeploy(action) {
  try {
    const tool = action.payload ? 'data-generator' : 'simulation';
    const model = yield select(getModel);
    const status = yield call(() => requestStartDeploy(tool, model));
    yield put(deployStartOK());
    yield put(setDeployStatus(status));
    yield put(
      setNotification({
        type: "success",
        message: `${tool.toUpperCase()} has been started!`
      })
    );
    // dispatch data
  } catch (error) {
    // dispatch error
    yield put(setNotification({ type: "error", message: error }));
  }
}

function* handleRequestStopDeploy(action) {
  try {
    const tool = action.payload ? 'data-generator' : 'simulation';
    yield call(() => requestStopDeploy(tool));
    yield put(deployStopOK());
    yield put(setDeployStatus(null));
    yield put(
      setNotification({
        type: "success",
        message: `${tool.toUpperCase()} has been stopped!`
      })
    );
    // dispatch data
  } catch (error) {
    // dispatch error
    yield put(setNotification({ type: "error", message: error }));
  }
}

function* handleRequestDeployStatus(action) {
  try {
    const tool = action.payload ? 'data-generator' : 'simulation';
    const status = yield call(() => requestDeployStatus(tool));
    // dispatch data
    yield put(setDeployStatus(status));
  } catch (error) {
    // dispatch error
    yield put(setNotification({ type: "error", message: error }));
  }
}

function* watchDeploy() {
  yield takeEvery("SEND_DEPLOY_START", handleRequestStartDeploy);
  yield takeEvery("SEND_DEPLOY_STOP", handleRequestStopDeploy);
  yield takeEvery("REQUEST_DEPLOY_STATUS", handleRequestDeployStatus);
}

export default watchDeploy;
