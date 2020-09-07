import {
  createReducer
} from "redux-act";
import {
  setDevopts,
} from "../actions";

const initState = null;

export default createReducer({
    [setDevopts]: (state, devopts) => devopts,
  },
  initState
);