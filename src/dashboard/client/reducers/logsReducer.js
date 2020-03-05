import { createReducer } from 'redux-act';
import produce from 'immer';
import { sendViewLogs, viewLogsOK, viewLogsFailed } from '../actions';

const initState  = {
  logs: null,
  fetching: false,
  error: null
}

export default createReducer({
  [sendViewLogs] : (state) => ({...state, fetching: true}),
  [viewLogsFailed] : (state, error) => ({...state, error, fetching: false}),
  [viewLogsOK] : produce((draft, logs) => {
    draft.logs = logs;
    draft.fetching = false;
  })
}, initState);
