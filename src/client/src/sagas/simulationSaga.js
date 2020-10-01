// watcher saga -> actions -> worker saga
import { call, put, takeEvery } from "redux-saga/effects";

import {
  sendRequestStartSimulation,
  sendRequestStopSimulation,
  sendRequestSimulationStatus
} from "../api";
import {
  setNotification,
  setSimulationStatus
} from "../actions";

function* handleRequestStartSimulation(action) {
  try {
    const {modelFileName, datasetId, newDataset} = action.payload;
    const status = yield call(() => sendRequestStartSimulation(modelFileName, datasetId, newDataset));
    yield put(setSimulationStatus(status));
    yield put(
      setNotification({
        type: "success",
        message: `Simulation has been started!`
      })
    );
    // dispatch data
  } catch (error) {
    // dispatch error
    yield put(setNotification({ type: "error", message: error }));
  }
}

function* handleRequestStopSimulation(action) {
  try {
    const fileName = action.payload;
    const status = yield call(() => sendRequestStopSimulation(fileName));
    yield put(setSimulationStatus(status));
    yield put(
      setNotification({
        type: "success",
        message: `Simulation has been stopped!`
      })
    );
    // dispatch data
  } catch (error) {
    // dispatch error
    yield put(setNotification({ type: "error", message: error }));
  }
}

function* handleRequestSimulationStatus() {
  try {
    const status = yield call(() => sendRequestSimulationStatus());
    // dispatch data
    yield put(setSimulationStatus(status));
  } catch (error) {
    // dispatch error
    yield put(setNotification({ type: "error", message: error }));
  }
}

function* watchSimulation() {
  yield takeEvery("REQUEST_START_SIMULATION", handleRequestStartSimulation);
  yield takeEvery("REQUEST_STOP_SIMULATION", handleRequestStopSimulation);
  yield takeEvery("REQUEST_SIMULATION_STATUS", handleRequestSimulationStatus);
}

export default watchSimulation;
