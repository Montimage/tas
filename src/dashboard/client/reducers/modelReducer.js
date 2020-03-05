import { createReducer } from "redux-act";
import produce from 'immer';
import { setModel, resetModel } from "../actions";

const initState = { name: "NewModel" };

export default createReducer(
  {
    [setModel]: produce((draft, model) => draft = model),
    [resetModel]: (state) => initState
  },
  initState
);
