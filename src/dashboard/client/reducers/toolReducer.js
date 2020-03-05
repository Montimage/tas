import { createReducer } from "redux-act";
import { changeTool } from "../actions";

export default createReducer(
  {
    [changeTool]: (state) => (state === 'simulation' ? 'data-generator' : 'simulation')
  },
  "simulation"
);
