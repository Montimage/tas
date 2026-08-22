import { createAction, createSlice } from '@reduxjs/toolkit';

import { addNewElementToArray, removeElementFromArray } from '../utils';

// Request triggers: watched by the datasets/events sagas and tracked by the
// global `requesting` flag, but no reducer of this domain consumes them.
export const requestAllDatasets = createAction('REQUEST_ALL_DATA_SETS');
export const requestDeleteDataset = createAction('REQUEST_DELETE_DATA_SET');
export const requestAddNewDataset = createAction('REQUEST_ADD_NEW_DATA_SET');
export const requestDataset = createAction('REQUEST_DATA_SET');
export const requestUpdateDataset = createAction('REQUEST_UPDATE_DATA_SET');
export const updateDatasetOK = createAction('UPDATE_DATA_SET_OK');
export const requestEventsByDatasetId = createAction('REQUEST_EVENTS_BY_DATASET_ID');
export const requestDeleteEvent = createAction('REQUEST_DELETE_EVENT');
export const requestAddNewEvent = createAction('REQUEST_ADD_NEW_EVENT');
// Watched by the events saga and tracked by the global `requesting` flag;
// no reducer of this domain consumes them.
export const requestEvent = createAction('REQUEST_EVENT');
export const requestUpdateEvent = createAction('REQUEST_UPDATE_EVENT');

const datasetsInitialState = {
  allDatasets: [],
  currentDataset: {
    dataset: null,
    events: [],
    totalNbEvents: 0,
  },
};

export const datasetsSlice = createSlice({
  name: 'datasets',
  initialState: datasetsInitialState,
  reducers: {
    setAllDatasets(state, action) {
      state.allDatasets = action.payload;
    },
    addNewDatasetOK(state, action) {
      const newDS = action.payload;
      if (state.allDatasets) {
        const newAllDatasets = addNewElementToArray(state.allDatasets, newDS);
        state.allDatasets = [...newAllDatasets];
      } else {
        state.allDatasets = [newDS];
      }
      state.currentDataset.dataset = newDS;
    },
    deleteDatasetOK(state, action) {
      const newAllDatasets = removeElementFromArray(
        state.allDatasets,
        action.payload
      );
      if (newAllDatasets) state.allDatasets = [...newAllDatasets];
    },
    setCurrentDataset(state, action) {
      state.currentDataset.dataset = action.payload;
    },
    setEvents(state, action) {
      state.currentDataset.events = [...state.currentDataset.events, ...action.payload];
    },
    setTotalNumberEvents(state, action) {
      state.currentDataset.totalNbEvents = action.payload;
    },
    addNewEventOK(state, action) {
      if (state) {
        state.currentDataset.events.push(action.payload);
        state.currentDataset.totalNbEvents += 1;
      } else {
        state.currentDataset.events = [action.payload];
        state.currentDataset.totalNbEvents = 1;
      }
    },
    deleteEventOK(state, action) {
      const eventId = action.payload;
      const newEvents = [];
      for (let index = 0; index < state.currentDataset.events.length; index++) {
        const event = state.currentDataset.events[index];
        if (event._id !== eventId) {
          newEvents.push(event);
        } else {
          state.currentDataset.totalNbEvents -= 1;
        }
      }
      state.currentDataset.events = [...newEvents];
    },
    updateEventOK(state, action) {
      const newEvent = action.payload;
      for (let index = 0; index < state.currentDataset.events.length; index++) {
        if (state.currentDataset.events[index]._id === newEvent._id) {
          state.currentDataset.events[index] = { ...newEvent };
        }
      }
    },
  },
});

export const {
  setAllDatasets,
  setCurrentDataset,
  deleteDatasetOK,
  addNewDatasetOK,
  setEvents,
  setTotalNumberEvents,
  deleteEventOK,
  addNewEventOK,
  updateEventOK,
} = datasetsSlice.actions;
