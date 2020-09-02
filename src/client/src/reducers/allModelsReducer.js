import {
  createReducer
} from "redux-act";
import produce from "immer";
import {
  setAllModels,
  deleteModelOK,
  duplicateModelOK,
  addNewModelOK
} from "../actions";

export default createReducer({
    [setAllModels]: produce((draft, models) => (draft = models)),
    [deleteModelOK]: produce((draft, modelFileName) => {
      const index = draft.indexOf(modelFileName);
      if (index === -1) {
        console.error('Cannot find model to delete: ', modelFileName);
      } else {
        draft = draft.splice(index, 1);
      }
    }),
    [duplicateModelOK]: produce((draft, dupModel) => draft = [...draft, dupModel]),
    [addNewModelOK]:produce((draft, newModel) => draft = [...draft, newModel])
  },
  []
);