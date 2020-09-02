import {
  createReducer
} from "redux-act";
import {
  setDevOpts,
} from "../actions";

const initState = null;

export default createReducer({
    [setDevOpts]: (state, devOpts) => devOpts,
  },
  initState
);