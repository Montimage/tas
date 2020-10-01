// watcher saga -> actions -> worker saga
import {
  call,
  put,
  takeEvery,
} from 'redux-saga/effects';

import {
  requestDataRecorder,
  requestAllDataRecorders,
  requestDeleteDataRecorder,
  requestDuplicateDataRecorder,
  uploadDataRecorder,
  updateDataRecorder,
  sendRequestStartDataRecorder,
  sendRequestStopDataRecorder,
  sendRequestDataRecorderStatus
} from '../api';
import {
  setDataRecorder,
  setNotification,
  setAllDataRecorders,
  deleteDataRecorderOK,
  duplicateDataRecorderOK,
  addNewDataRecorderOK,
  updateDataRecorderOK,
  setDataRecorderStatus
} from '../actions';

function* handleRequestDataRecorder(action) {
  try {
    const dataRecorderFileName = action.payload;
    const dataRecorder = yield call(() => requestDataRecorder(dataRecorderFileName));
    yield put(setDataRecorder(dataRecorder));
    // dispatch data
  } catch (error) {
    // dispatch error
    yield put(setNotification({type: 'error', message: error}));
  }
}

function* handleRequestDeleteDataRecorder(action) {
  try {
    const dataRecorderFileName = action.payload;
    yield call(() => requestDeleteDataRecorder(dataRecorderFileName));
    yield put(deleteDataRecorderOK(dataRecorderFileName));
    yield put(setNotification({type: 'success', message: `DataRecorder ${dataRecorderFileName} has been deleted!`}));
    // dispatch data
  } catch (error) {
    // dispatch error
    yield put(setNotification({type: 'error', message: error}));
  }
}

function* handleRequestDuplicateDataRecorder(action) {
  try {
    const dataRecorderFileName = action.payload;
    const duplicatedDataRecorder = yield call(() => requestDuplicateDataRecorder(dataRecorderFileName));
    yield put(duplicateDataRecorderOK(duplicatedDataRecorder));
    yield put(setNotification({type: 'success', message: `DataRecorder ${duplicatedDataRecorder} has been created!`}));
    // dispatch data
  } catch (error) {
    // dispatch error
    yield put(setNotification({type: 'error', message: error}));
  }
}

function* handleRequestAddNewDataRecorder(action) {
  try {
    const dataRecorder = action.payload;
    const dataRecorderFileName = yield call(() => uploadDataRecorder(dataRecorder));
    yield put(addNewDataRecorderOK(dataRecorderFileName));
    yield put(setNotification({type: 'success', message: `DataRecorder ${dataRecorderFileName} has been created!`}));
    // dispatch data
  } catch (error) {
    // dispatch error
    yield put(setNotification({type: 'error', message: error}));
  }
}

function* handleRequestUpdateDataRecorder(action) {
  try {
    const {dataRecorderFileName, dataRecorder} = action.payload;
    yield call(() => updateDataRecorder(dataRecorderFileName, dataRecorder));
    yield put(updateDataRecorderOK(dataRecorderFileName));
    yield put(setNotification({type: 'success', message: `DataRecorder ${dataRecorderFileName} has been updated!`}));
    // dispatch data
  } catch (error) {
    // dispatch error
    yield put(setNotification({type: 'error', message: error}));
  }
}

function* handleRequestStartDataRecorder(action) {
  try {
    const dataRecorderFileName = action.payload;
    const status = yield call(() => sendRequestStartDataRecorder(dataRecorderFileName));
    yield put(setDataRecorderStatus(status));
    yield put(setNotification({type: 'success', message: `DataRecorder has been started!`}));
    // dispatch data
  } catch (error) {
    // dispatch error
    yield put(setNotification({type: 'error', message: error}));
  }
}

function* handleRequestStopDataRecorder(action) {
  try {
    const dataRecorderFileName = action.payload;
    const status = yield call(() => sendRequestStopDataRecorder(dataRecorderFileName));
    yield put(setDataRecorderStatus(status));
    yield put(setNotification({type: 'success', message: `DataRecorder has been stopped!`}));
    // dispatch data
  } catch (error) {
    // dispatch error
    yield put(setNotification({type: 'error', message: error}));
  }
}

function* handleRequestDataRecorderStatus() {
  try {
    const status = yield call(() => sendRequestDataRecorderStatus());
    yield put(setDataRecorderStatus(status));
    // yield put(setNotification({type: 'success', message: `DataRecorder ${dataRecorderFileName} has been started!`}));
    // dispatch data
  } catch (error) {
    // dispatch error
    yield put(setNotification({type: 'error', message: error}));
  }
}

function* handleRequestAllDataRecorders() {
  try {
    const dataRecorders = yield call(() => requestAllDataRecorders());
    yield put(setAllDataRecorders(dataRecorders));
    // dispatch data
  } catch (error) {
    // dispatch error
    yield put(setNotification({type: 'error', message: error}));
  }
}

function* watchRequestDataRecorder() {
  yield takeEvery('REQUEST_DATA_RECORDER', handleRequestDataRecorder);
  yield takeEvery('REQUEST_ALL_DATA_RECORDERS', handleRequestAllDataRecorders);
  yield takeEvery('REQUEST_DELETE_DATA_RECORDER', handleRequestDeleteDataRecorder);
  yield takeEvery('REQUEST_DUPLICATE_DATA_RECORDER', handleRequestDuplicateDataRecorder);
  yield takeEvery('REQUEST_ADD_NEW_DATA_RECORDER', handleRequestAddNewDataRecorder);
  yield takeEvery('REQUEST_UPDATE_DATA_RECORDER', handleRequestUpdateDataRecorder);
  yield takeEvery('REQUEST_START_DATA_RECORDER', handleRequestStartDataRecorder);
  yield takeEvery('REQUEST_STOP_DATA_RECORDER', handleRequestStopDataRecorder);
  yield takeEvery('REQUEST_DATA_RECORDER_STATUS', handleRequestDataRecorderStatus);
}

export default watchRequestDataRecorder;
