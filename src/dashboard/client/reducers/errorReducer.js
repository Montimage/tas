import { createReducer } from "redux-act";
import { setError } from "../actions";

export default createReducer(
  {
    [setError]: (state, error) => error
  },
  null
);
