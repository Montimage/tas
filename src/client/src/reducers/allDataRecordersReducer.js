import {
  createReducer
} from "redux-act";
import produce from "immer";
import {
  setAllDataRecorders,
  deleteDataRecorderOK,
  duplicateDataRecorderOK,
  addNewDataRecorderOK
} from "../actions";

export default createReducer({
    [setAllDataRecorders]: produce((draft, dataRecorders) => (draft = dataRecorders)),
    [deleteDataRecorderOK]: produce((draft, dataRecorderFileName) => {
      const index = draft.indexOf(dataRecorderFileName);
      if (index === -1) {
        console.error('Cannot find DataRecorder to delete: ', dataRecorderFileName);
      } else {
        draft = draft.splice(index, 1);
      }
    }),
    [duplicateDataRecorderOK]: produce((draft, dupDataRecorder) => draft = [...draft, dupDataRecorder]),
    [addNewDataRecorderOK]:produce((draft, newDataRecorder) => draft = [...draft, newDataRecorder])
  },
  []
);