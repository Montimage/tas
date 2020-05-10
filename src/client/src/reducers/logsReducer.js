import { createReducer } from "redux-act";
import produce from 'immer';
import { requestLogsOK, requestLogFilesOK, requestDeleteLogFile } from "../actions";

const initState = {
  logs: null,
  logFiles: []
};

export default createReducer(
  {
    [requestLogsOK]: (state, logs) => ({...state, logs}),
    [requestLogFilesOK]: (state, logFiles) => ({...state, logFiles}),
    [requestDeleteLogFile]: produce((draft, file) => {
      const index = draft.logFiles.indexOf(file);
      if (index > - 1) {
        draft.logFiles.splice(index, 1);
      }
    })
  },
  initState
);
