import { createReducer } from "redux-act";
import { requestStatsOK } from "../actions";

const initState = [];

export default createReducer(
  {
    [requestStatsOK]: (state, stats) => (stats),
  },
  initState
);
