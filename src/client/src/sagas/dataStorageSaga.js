// watcher saga -> actions -> worker saga
import {
  call,
  put,
  takeEvery,
} from 'redux-saga/effects';

import {
  sendRequestDataStorage,
  sendRequestUpdateDataStorage,
  sendRequestTestDataStorageConnection
} from '../api';
import {
  setNotification,
  setDataStorage,
  setDataStorageConnectionStatus
} from '../actions';

function* handleRequestDataStorage() {
  try {
    const dataStorage = yield call(() => sendRequestDataStorage());
    yield put(setDataStorage(dataStorage));
    // dispatch data
  } catch (error) {
    // dispatch error
    yield put(setNotification({type: 'error', message: error}));
  }
}

function* handleRequestUpdateDataStorage(action) {  
  try {
    const newDataStorage = action.payload;
    yield call(() => sendRequestUpdateDataStorage(newDataStorage));
    yield put(setDataStorage(newDataStorage));
    yield put(setNotification({type: 'success', message: `DataStorage has been updated!`}));
    // dispatch data
  } catch (error) {
    // dispatch error
    yield put(setNotification({type: 'error', message: error}));
  }
}

function* handleRequestTestDataStorageConnection() {  
  try {
    const status = yield call(() => sendRequestTestDataStorageConnection());
    yield put(setDataStorageConnectionStatus(status));
    // dispatch data
  } catch (error) {
    // dispatch error
    yield put(setDataStorageConnectionStatus(false));
    yield put(setNotification({type: 'error', message: error}));
  }
}

function* watchRequestDataStorage() {
  yield takeEvery('REQUEST_DATA_STORAGE', handleRequestDataStorage);
  yield takeEvery('REQUEST_UPDATE_DATA_STORAGE', handleRequestUpdateDataStorage);
  yield takeEvery('REQUEST_TEST_DATA_STORAGE_CONNECTION', handleRequestTestDataStorageConnection);
}

export default watchRequestDataStorage;
