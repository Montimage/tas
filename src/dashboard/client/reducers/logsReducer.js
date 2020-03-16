import { createReducer } from "redux-act";
import { requestLogsOK, requestLogFilesOK, selectLogFile, changeTool } from "../actions";

const initState = {
  file: null,
  logs: null,
  logFiles: []
};

export default createReducer(
  {
    [requestLogsOK]: (state, logs) => ({...state, logs}),
    [requestLogFilesOK]: (state, logFiles) => ({...state, logFiles}),
    [selectLogFile]: (state, file) => ({...state, file}),
    [changeTool]: (state) => initState
  },
  initState
);
