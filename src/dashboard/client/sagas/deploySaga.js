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

const getTool = ({ tool }) => tool;
const getModel = ({ model }) => model;

function* handleRequestStartDeploy() {
  try {
    const tool = yield select(getTool);
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

function* handleRequestStopDeploy() {
  try {
    const tool = yield select(getTool);
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

function* handleRequestDeployStatus() {
  try {
    const tool = yield select(getTool);
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
