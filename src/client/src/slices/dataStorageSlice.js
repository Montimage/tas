import { createAction, createSlice } from '@reduxjs/toolkit';

// Request triggers: watched by the data-storage saga and tracked by the
// global `requesting` flag, but no reducer of this domain consumes them.
export const requestDataStorage = createAction('REQUEST_DATA_STORAGE');
export const requestUpdateDataStorage = createAction('REQUEST_UPDATE_DATA_STORAGE');
export const requestTestDataStorageConnection = createAction('REQUEST_TEST_DATA_STORAGE_CONNECTION');
// Form-only selection: dispatched by components, reduced by nobody
// (unchanged from the pre-toolkit catalogue).
export const selectDataStorage = createAction('SELECT_DATA_STORAGE');

const dataStorageInitialState = {
  connConfig: null,
  connectionStatus: false,
};

export const dataStorageSlice = createSlice({
  name: 'dataStorage',
  initialState: dataStorageInitialState,
  reducers: {
    setDataStorage(state, action) {
      state.connConfig = action.payload;
    },
    setDataStorageConnectionStatus(state, action) {
      state.connectionStatus = action.payload;
    },
  },
});

export const { setDataStorage, setDataStorageConnectionStatus } =
  dataStorageSlice.actions;
