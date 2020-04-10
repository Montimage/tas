import { createReducer } from "redux-act";
import produce from 'immer';
import { requestLogsOK, requestLogFilesOK, selectLogFile, changeTool, requestDeleteLogFile } from "../actions";

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
    [requestDeleteLogFile]: produce((draft, file) => {
      const index = draft.logFiles.indexOf(file);
      if (index > - 1) {
        draft.logFiles.splice(index, 1);
      }
    }),
    [changeTool]: (state) => initState
  },
  initState
);
