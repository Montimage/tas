import { createReducer } from "redux-act";
import produce from 'immer';
import { requestLogFileOK, requestAllLogFilesOK, requestDeleteLogFileOK } from "../actions";

const initState = {
  logs: null,
  logFiles: [],
};

export default createReducer(
  {
    [requestLogFileOK]: (state, logs) => ({...state, logs}),
    [requestAllLogFilesOK]: (state, logFiles) => ({...state, logFiles}),
    [requestDeleteLogFileOK]: produce((draft, logFile) => {
      const index = draft.logFiles.indexOf(logFile);
      if (index > - 1) {
        draft.logFiles.splice(index, 1);
      }
    })
  },
  initState
);
