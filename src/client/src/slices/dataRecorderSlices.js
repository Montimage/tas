import { createAction, createSlice } from '@reduxjs/toolkit';

// Request triggers: watched by the data-recorder sagas and tracked by the
// global `requesting` flag, but no reducer of this domain consumes them.
export const requestAllDataRecorders = createAction('REQUEST_ALL_DATA_RECORDERS');
export const requestDeleteDataRecorder = createAction('REQUEST_DELETE_DATA_RECORDER');
export const requestDuplicateDataRecorder = createAction('REQUEST_DUPLICATE_DATA_RECORDER');
export const requestAddNewDataRecorder = createAction('REQUEST_ADD_NEW_DATA_RECORDER');
export const requestUpdateDataRecorder = createAction('REQUEST_UPDATE_DATA_RECORDER');
export const requestDataRecorder = createAction('REQUEST_DATA_RECORDER');
export const requestStartDataRecorder = createAction('REQUEST_START_DATA_RECORDER');
export const requestStopDataRecorder = createAction('REQUEST_STOP_DATA_RECORDER');
export const requestDataRecorderStatus = createAction('REQUEST_DATA_RECORDER_STATUS');
// Settle-only action: tracked by the global `requesting` flag and dispatched
// by the data-recorder saga; no reducer of this domain consumes it.
export const updateDataRecorderOK = createAction('UPDATE_DATA_RECORDER_OK');

const allDataRecordersInitialState = [];

export const allDataRecordersSlice = createSlice({
  name: 'allDataRecorders',
  initialState: allDataRecordersInitialState,
  reducers: {
    setAllDataRecorders: (state, action) => action.payload,
    deleteDataRecorderOK(state, action) {
      const index = state.indexOf(action.payload);
      if (index === -1) {
        console.error('Cannot find DataRecorder to delete: ', action.payload);
      } else {
        state.splice(index, 1);
      }
    },
    duplicateDataRecorderOK(state, action) {
      state.push(action.payload);
    },
    addNewDataRecorderOK(state, action) {
      state.push(action.payload);
    },
  },
});

export const {
  setAllDataRecorders,
  deleteDataRecorderOK,
  duplicateDataRecorderOK,
  addNewDataRecorderOK,
} = allDataRecordersSlice.actions;

const dataRecorderInitialState = null;

export const dataRecorderSlice = createSlice({
  name: 'dataRecorder',
  initialState: dataRecorderInitialState,
  reducers: {
    setDataRecorder: (state, action) => action.payload,
    resetDataRecorder() {
      return dataRecorderInitialState;
    },
    changeDataRecorderName(state, action) {
      state.name = action.payload;
    },
  },
});

export const { setDataRecorder, resetDataRecorder, changeDataRecorderName } =
  dataRecorderSlice.actions;

export const dataRecorderStatusSlice = createSlice({
  name: 'dataRecorderStatus',
  initialState: null,
  reducers: {
    setDataRecorderStatus: (state, action) => action.payload,
  },
});

export const { setDataRecorderStatus } = dataRecorderStatusSlice.actions;
