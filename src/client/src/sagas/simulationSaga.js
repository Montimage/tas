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
    const SimulationStatus = yield call(() => sendRequestStartSimulation(modelFileName, datasetId, newDataset));
    yield put(setSimulationStatus(SimulationStatus));
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

function* handleRequestStopSimulation() {
  try {
    yield call(() => sendRequestStopSimulation());
    yield put(setSimulationStatus(null));
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
