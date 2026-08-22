// watcher saga -> actions -> worker saga
import {
  call,
  put,
  takeEvery,
} from 'redux-saga/effects';

import {
  sendRequestAllTestCases,
  sendRequestAddNewTestCase,
  sendRequestDeleteTestCase,
  sendRequestTestCase,
  sendRequestUpdateTestCase
} from '../api';
import {
  setNotification,
  setAllTestCases,
  addNewTestCaseOK,
  deleteTestCaseOK,
  setCurrentTestCase,
  requestTestCase,
  requestUpdateTestCase,
  requestAllTestCases,
  requestAddNewTestCase,
  requestDeleteTestCase,
} from '../actions';

function* handleRequestTestCase(action) {
  try {
    const tcId = action.payload;
    const testCase = yield call(() => sendRequestTestCase(tcId));
    yield put(setCurrentTestCase(testCase));
    // dispatch data
  } catch (error) {
    // dispatch error
    yield put(setNotification({
      type: 'error',
      message: error
    }));
  }
}

function* handleRequestUpdateTestCase(action) {
  try {
    const {id, testCase } = action.payload;
    const newTestCase = yield call(() => sendRequestUpdateTestCase(id, testCase));
    yield put(addNewTestCaseOK(newTestCase));
    yield put(setNotification({
      type: 'success',
      message: `A new test case ${newTestCase.name} has been added`
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


function* handleRequestAllTestCases() {
  try {
    const allTestCases = yield call(() => sendRequestAllTestCases());
    yield put(setAllTestCases(allTestCases));
    // dispatch data
  } catch (error) {
    // dispatch error
    yield put(setNotification({
      type: 'error',
      message: error
    }));
  }
}

function* handleRequestAddNewTestCase(action) {
  try {
    const testCase = action.payload;
    const newTestCase = yield call(() => sendRequestAddNewTestCase(testCase));
    yield put(addNewTestCaseOK(newTestCase));
    yield put(setNotification({
      type: 'success',
      message: `A new test case ${newTestCase.name} has been added`
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

function* handleRequestDeleteTestCase(action) {
  try {
    const testCaseId = action.payload;
    yield call(() => sendRequestDeleteTestCase(testCaseId));
    yield put(deleteTestCaseOK(testCaseId));
    yield put(setNotification({
      type: 'success',
      message: `Test case ${testCaseId} has been deleted`
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

function* watchTestCases() {
  yield takeEvery(requestTestCase, handleRequestTestCase);
  yield takeEvery(requestUpdateTestCase, handleRequestUpdateTestCase);
  yield takeEvery(requestAllTestCases, handleRequestAllTestCases);
  yield takeEvery(requestAddNewTestCase, handleRequestAddNewTestCase);
  yield takeEvery(requestDeleteTestCase, handleRequestDeleteTestCase);
}

export default watchTestCases;