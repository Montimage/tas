import {
  createReducer
} from "redux-act";
import produce from "immer";
import {
  setAllDatasets,
  setCurrentDataset,
  deleteDatasetOK,
  addNewDatasetOK,
  setEvents,
  addNewEventOK,
  deleteEventOK,
  updateEventOK,
  setTotalNumberEvents
} from "../actions";

import { addNewElementToArray, removeElementFromArray } from "../utils";

const initState = {
  allDatasets: [],
  currentDataset: {
    dataset: null,
    events:[],
    totalNbEvents: 0,
  }
};

export default createReducer({
    [setAllDatasets]: produce((draft, datasets) => {
      draft.allDatasets = datasets;
    }),
    [addNewDatasetOK]: produce((draft, newDS) => {
      if (draft.allDatasets) {
        const newAllDatasets = addNewElementToArray(draft.allDatasets, newDS);
        draft.allDatasets = [...newAllDatasets];
      } else {
        draft.allDatasets = [newDS];
      }
      draft.currentDataset.dataset = newDS;
    }),
    [deleteDatasetOK]: produce((draft, datasetId) => {
      const newAllDatasets = removeElementFromArray(draft.allDatasets, datasetId);
      if (newAllDatasets) draft.allDatasets = [...newAllDatasets];
    }),
    [setCurrentDataset]: produce((draft, dataset) => {
      draft.currentDataset.dataset = dataset;
    }),
    [setEvents]: produce((draft, events) => {
      draft.currentDataset.events = [...draft.currentDataset.events, ...events];
    }),
    [setTotalNumberEvents]: produce((draft, totalNbEvents) => {
      draft.currentDataset.totalNbEvents = totalNbEvents;
    }),
    [addNewEventOK]: produce((draft, newEvent) => {
      if (draft) {
        draft.currentDataset.events.push(newEvent);
        draft.currentDataset.totalNbEvents += 1;
      } else {
        draft.currentDataset.events = [newEvent];
        draft.currentDataset.totalNbEvents = 1;
      }
    }),
    [deleteEventOK]: produce((draft, eventId) => {
      const newEvents = [];
      for (let index = 0; index < draft.currentDataset.events.length; index++) {
        const event = draft.currentDataset.events[index];
        if (event._id !== eventId) {
          newEvents.push(event);
        } else {
          draft.currentDataset.totalNbEvents -= 1;
        }
      }
      draft.currentDataset.events = [...newEvents];
    }),
    [updateEventOK]: produce((draft, newEvent) => {
      for (let index = 0; index < draft.currentDataset.events.length; index++) {
        if (draft.currentDataset.events[index]._id === newEvent._id) {
          draft.currentDataset.events[index] = {...newEvent};
        };
      }
    })
  },
  initState
);