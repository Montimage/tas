import { createReducer } from "redux-act";
import produce from "immer";
import {
  setDataRecorder,
  resetDataRecorder,
  changeDataRecorderName,
} from "../actions";

const initState = { name: "New Data Recorder" };

export default createReducer(
  {
    [setDataRecorder]: produce((draft, dataRecorder) => (draft = dataRecorder)),
    [resetDataRecorder]: state => initState,
    // modification
    [changeDataRecorderName]: produce((draft, newName) => {
      draft.name = newName;
    })
  },
  initState
);