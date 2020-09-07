import { all } from "redux-saga/effects";

import requestModelSaga from "./requestModelSaga";
import uploadModelSaga from "./uploadModelSaga";
import simulationSaga from "./simulationSaga";
import requestLogsSaga from './requestLogsSaga';
import requestDataRecorderSaga from "./requestDataRecorderSaga";
import dataStorageSaga from './dataStorageSaga';
import testCampaignsSaga from './testCampaignsSaga';
import testCasesSaga from './testCasesSaga';
import datasetsSaga from './datasetsSaga';
import eventsSaga from './eventsSaga';
import devoptsSaga from './devoptsSaga';

function* rootSaga() {
  yield all([
    requestModelSaga(),
    requestDataRecorderSaga(),
    uploadModelSaga(),
    simulationSaga(),
    requestLogsSaga(),
    dataStorageSaga(),
    testCampaignsSaga(),
    devoptsSaga(),
    testCasesSaga(),
    datasetsSaga(),
    eventsSaga(),
  ]);
}

export default rootSaga;
