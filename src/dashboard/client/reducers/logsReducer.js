import { createReducer } from "redux-act";
import { requestLogsOK, requestLogFilesOK, selectLogFile } from "../actions";

export default createReducer(
  {
    [requestLogsOK]: (state, logs) => ({...state, logs}),
    [requestLogFilesOK]: (state, logFiles) => ({...state, logFiles}),
    [selectLogFile]: (state, file) => ({...state, file})
  },
  {
    file: null,
    logs: null,
    logFiles: []
  }
);
