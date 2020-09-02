// watcher saga -> actions -> worker saga
import {
  call,
  put,
  takeEvery,
} from 'redux-saga/effects';

import {
  sendRequestAllTestCampaigns,
  sendRequestAddNewTestCampaign,
  sendRequestDeleteTestCampaign,
  sendRequestTestCampaign,
  sendRequestUpdateTestCampaign,
  sendRequestLaunchTestCampaign,
  sendRequestStopTestCampaign,
  sendRequestTestCampaignStatus,
} from '../api';
import {
  setNotification,
  setAllTestCampaigns,
  addNewTestCampaignOK,
  deleteTestCampaignOK,
  setCurrentTestCampaign,
  setTestCampaignRunningStatus
} from '../actions';

function* handleRequestTestCampaign(action) {
  try {
    const tcId = action.payload;
    const testCampaign = yield call(() => sendRequestTestCampaign(tcId));
    yield put(setCurrentTestCampaign(testCampaign));
    // dispatch data
  } catch (error) {
    // dispatch error
    yield put(setNotification({
      type: 'error',
      message: error
    }));
  }
}

function* handleRequestUpdateTestCampaign(action) {
  try {
    const {id, testCampaign } = action.payload;
    const newTestCampaign = yield call(() => sendRequestUpdateTestCampaign(id, testCampaign));
    yield put(addNewTestCampaignOK(newTestCampaign));
    yield put(setNotification({
      type: 'success',
      message: `A new test campaign ${newTestCampaign.name} has been added`
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


function* handleRequestAllTestCampaigns() {
  try {
    const allTestCampaigns = yield call(() => sendRequestAllTestCampaigns());
    yield put(setAllTestCampaigns(allTestCampaigns));
    // dispatch data
  } catch (error) {
    // dispatch error
    yield put(setNotification({
      type: 'error',
      message: error
    }));
  }
}

function* handleRequestAddNewTestCampaign(action) {
  try {
    const testCampaign = action.payload;
    const newTestCampaign = yield call(() => sendRequestAddNewTestCampaign(testCampaign));
    yield put(addNewTestCampaignOK(newTestCampaign));
    yield put(setNotification({
      type: 'success',
      message: `A new test campaign ${newTestCampaign.name} has been added`
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

function* handleRequestDeleteTestCampaign(action) {
  try {
    const testCampaignId = action.payload;
    yield call(() => sendRequestDeleteTestCampaign(testCampaignId));
    yield put(deleteTestCampaignOK(testCampaignId));
    yield put(setNotification({
      type: 'success',
      message: `Test campaign ${testCampaignId} has been deleted`
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

function* handleRequestLaunchTestCampaign() {
  try {
    const runningStatus = yield call(() => sendRequestLaunchTestCampaign());
    yield put(setTestCampaignRunningStatus(runningStatus));
    yield put(setNotification({
      type: 'success',
      message: `Test campaign has been started`
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

function* handleRequestStopTestCampaign() {
  try {
    const runningStatus = yield call(() => sendRequestStopTestCampaign());
    yield put(setTestCampaignRunningStatus(runningStatus));
    yield put(setNotification({
      type: 'success',
      message: `Test campaign has been stopped`
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

function* handleRequestTestCampaignStatus() {
  try {
    const runningStatus = yield call(() => sendRequestTestCampaignStatus());
    yield put(setTestCampaignRunningStatus(runningStatus));
  } catch (error) {
    // dispatch error
    yield put(setNotification({
      type: 'error',
      message: error
    }));
  }
}

function* watchTestCampaigns() {
  yield takeEvery('REQUEST_TEST_CAMPAIGN', handleRequestTestCampaign);
  yield takeEvery('REQUEST_UPDATE_TEST_CAMPAIGN', handleRequestUpdateTestCampaign);
  yield takeEvery('REQUEST_ALL_TEST_CAMPAIGNS', handleRequestAllTestCampaigns);
  yield takeEvery('REQUEST_ADD_NEW_TEST_CAMPAIGN', handleRequestAddNewTestCampaign);
  yield takeEvery('REQUEST_DELETE_TEST_CAMPAIGN', handleRequestDeleteTestCampaign);
  yield takeEvery('REQUEST_LAUNCH_TEST_CAMPAIGN', handleRequestLaunchTestCampaign);
  yield takeEvery('REQUEST_STOP_TEST_CAMPAIGN', handleRequestStopTestCampaign);
  yield takeEvery('REQUEST_TEST_CAMPAIGN_STATUS', handleRequestTestCampaignStatus);
}

export default watchTestCampaigns;