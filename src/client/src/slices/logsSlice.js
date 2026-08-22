import { createAction, createSlice } from '@reduxjs/toolkit';

// Request triggers: watched by the logs saga and tracked by the global
// `requesting` flag, but no reducer of this domain consumes them.
export const requestAllLogFiles = createAction('REQUEST_ALL_LOG_FILES');
export const requestLogFile = createAction('REQUEST_LOG_FILE');
export const requestDeleteLogFile = createAction('REQUEST_DELETE_LOG_FILE');

const logsInitialState = {
  logs: null,
  logFiles: [],
};

export const logsSlice = createSlice({
  name: 'logs',
  initialState: logsInitialState,
  reducers: {
    requestLogFileOK(state, action) {
      state.logs = action.payload;
    },
    requestAllLogFilesOK(state, action) {
      state.logFiles = action.payload;
    },
    requestDeleteLogFileOK(state, action) {
      const index = state.logFiles.indexOf(action.payload);
      if (index > -1) {
        state.logFiles.splice(index, 1);
      }
    },
  },
});

export const {
  requestLogFileOK,
  requestAllLogFilesOK,
  requestDeleteLogFileOK,
} = logsSlice.actions;
