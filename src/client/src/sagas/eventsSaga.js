// watcher saga -> actions -> worker saga
import {
  call,
  put,
  takeEvery,
} from 'redux-saga/effects';

import {
  sendRequestEventsByDatasetId,
  sendRequestAddNewEvent,
  sendRequestDeleteEvent,
  sendRequestEvent,
  sendRequestUpdateEvent
} from '../api';
import {
  setNotification,
  setEvents,
  addNewEventOK,
  deleteEventOK,
  updateEventOK
} from '../actions';

function* handleRequestEvent(action) {
  try {
    const tcId = action.payload;
    yield call(() => sendRequestEvent(tcId));
    // dispatch data
  } catch (error) {
    // dispatch error
    yield put(setNotification({
      type: 'error',
      message: error
    }));
  }
}

function* handleRequestEventsByDatasetId(action) {
  try {
    const dsId = action.payload;
    const events = yield call(() => sendRequestEventsByDatasetId(dsId));
    yield put(setEvents(events));
    // dispatch data
  } catch (error) {
    // dispatch error
    yield put(setNotification({
      type: 'error',
      message: error
    }));
  }
}

function* handleRequestUpdateEvent(action) {
  try {
    const {id, event } = action.payload;
    yield call(() => sendRequestUpdateEvent(id, event));
    yield put(updateEventOK(event));
    yield put(setNotification({
      type: 'success',
      message: `The event ${id} has been updated`
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


function* handleRequestAllEvents() {
  try {
    const allEvents = yield call(() => sendRequestEventsByDatasetId());
    yield put(setEvents(allEvents));
    // dispatch data
  } catch (error) {
    // dispatch error
    yield put(setNotification({
      type: 'error',
      message: error
    }));
  }
}

function* handleRequestAddNewEvent(action) {
  try {
    const event = action.payload;
    const newEvent = yield call(() => sendRequestAddNewEvent(event));
    yield put(addNewEventOK(newEvent));
    yield put(setNotification({
      type: 'success',
      message: `A new event ${newEvent._id} has been added`
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

function* handleRequestDeleteEvent(action) {
  try {
    const eventId = action.payload;
    yield call(() => sendRequestDeleteEvent(eventId));
    yield put(deleteEventOK(eventId));
    yield put(setNotification({
      type: 'success',
      message: `Event ${eventId} has been deleted`
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

function* watchEvents() {
  yield takeEvery('REQUEST_EVENT', handleRequestEvent);
  yield takeEvery('REQUEST_EVENTS_BY_DATASET_ID', handleRequestEventsByDatasetId);
  yield takeEvery('REQUEST_UPDATE_EVENT', handleRequestUpdateEvent);
  yield takeEvery('REQUEST_ALL_EVENTS', handleRequestAllEvents);
  yield takeEvery('REQUEST_ADD_NEW_EVENT', handleRequestAddNewEvent);
  yield takeEvery('REQUEST_DELETE_EVENT', handleRequestDeleteEvent);
}

export default watchEvents;