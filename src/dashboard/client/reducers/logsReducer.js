import { createReducer } from "redux-act";
import { requestLogsOK } from "../actions";

export default createReducer(
  {
    [requestLogsOK]: (state, logs) => logs
  },
  null
);
