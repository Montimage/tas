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
  yield takeEvery('REQUEST_TEST_CASE', handleRequestTestCase);
  yield takeEvery('REQUEST_UPDATE_TEST_CASE', handleRequestUpdateTestCase);
  yield takeEvery('REQUEST_ALL_TEST_CASES', handleRequestAllTestCases);
  yield takeEvery('REQUEST_ADD_NEW_TEST_CASE', handleRequestAddNewTestCase);
  yield takeEvery('REQUEST_DELETE_TEST_CASE', handleRequestDeleteTestCase);
}

export default watchTestCases;