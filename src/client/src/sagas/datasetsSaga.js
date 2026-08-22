// watcher saga -> actions -> worker saga
import {
  call,
  put,
  takeEvery,
} from 'redux-saga/effects';

import {
  sendRequestAllDatasets,
  sendRequestAddNewDataset,
  sendRequestDeleteDataset,
  sendRequestDataset,
  sendRequestUpdateDataset
} from '../api';
import {
  setNotification,
  setAllDatasets,
  addNewDatasetOK,
  deleteDatasetOK,
  setCurrentDataset,
  requestDataset,
  requestUpdateDataset,
  requestAllDatasets,
  requestAddNewDataset,
  requestDeleteDataset,
} from '../actions';

function* handleRequestDataset(action) {
  try {
    const tcId = action.payload;
    const dataset = yield call(() => sendRequestDataset(tcId));
    yield put(setCurrentDataset(dataset));
    // dispatch data
  } catch (error) {
    // dispatch error
    yield put(setNotification({
      type: 'error',
      message: error
    }));
  }
}

function* handleRequestUpdateDataset(action) {
  try {
    const {id, Dataset } = action.payload;
    const newDataset = yield call(() => sendRequestUpdateDataset(id, Dataset));
    yield put(addNewDatasetOK(newDataset));
    yield put(setNotification({
      type: 'success',
      message: `A new dataset ${newDataset.name} has been added`
    }));
    // dispatch data
  } catch (error) {
    // dispatch error
    yield put(setNotification({
      type: 'error',
      message: error
    }));
  }
}


function* handleRequestAllDatasets() {
  try {
    const allDatasets = yield call(() => sendRequestAllDatasets());
    yield put(setAllDatasets(allDatasets));
    // dispatch data
  } catch (error) {
    // dispatch error
    yield put(setNotification({
      type: 'error',
      message: error
    }));
  }
}

function* handleRequestAddNewDataset(action) {
  try {
    const Dataset = action.payload;
    const newDataset = yield call(() => sendRequestAddNewDataset(Dataset));
    yield put(addNewDatasetOK(newDataset));
    yield put(setNotification({
      type: 'success',
      message: `A new dataset ${newDataset.name} has been added`
    }));
    // dispatch data
  } catch (error) {
    // dispatch error
    yield put(setNotification({
      type: 'error',
      message: error
    }));
  }
}

function* handleRequestDeleteDataset(action) {
  try {
    const datasetId = action.payload;
    yield call(() => sendRequestDeleteDataset(datasetId));
    yield put(deleteDatasetOK(datasetId));
    yield put(setNotification({
      type: 'success',
      message: `Test case ${datasetId} has been deleted`
    }));
    // dispatch data
  } catch (error) {
    // dispatch error
    yield put(setNotification({
      type: 'error',
      message: error
    }));
  }
}

function* watchDatasets() {
  yield takeEvery(requestDataset, handleRequestDataset);
  yield takeEvery(requestUpdateDataset, handleRequestUpdateDataset);
  yield takeEvery(requestAllDatasets, handleRequestAllDatasets);
  yield takeEvery(requestAddNewDataset, handleRequestAddNewDataset);
  yield takeEvery(requestDeleteDataset, handleRequestDeleteDataset);
}

export default watchDatasets;