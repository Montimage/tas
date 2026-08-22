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
  updateEventOK,
  setTotalNumberEvents,
  requestEvent,
  requestEventsByDatasetId,
  requestUpdateEvent,
  requestAddNewEvent,
  requestDeleteEvent
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
    const {datasetId, startTime, endTime, page} = action.payload;
    const {totalNbEvents, events} = yield call(() => sendRequestEventsByDatasetId(datasetId, startTime, endTime, page));
    if (totalNbEvents) yield put(setTotalNumberEvents(totalNbEvents));
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
  yield takeEvery(requestEvent, handleRequestEvent);
  yield takeEvery(requestEventsByDatasetId, handleRequestEventsByDatasetId);
  yield takeEvery(requestUpdateEvent, handleRequestUpdateEvent);
  // No `requestAllEvents` creator exists; this watcher has always been dead.
  yield takeEvery('REQUEST_ALL_EVENTS', handleRequestAllEvents);
  yield takeEvery(requestAddNewEvent, handleRequestAddNewEvent);
  yield takeEvery(requestDeleteEvent, handleRequestDeleteEvent);
}

export default watchEvents;