import {
  createReducer
} from "redux-act";
import {
  setDevops,
} from "../actions";

const initState = null;

export default createReducer({
    [setDevops]: (state, devops) => devops,
  },
  initState
);