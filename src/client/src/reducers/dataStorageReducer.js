import {
  createReducer
} from "redux-act";
import produce from "immer";
import {
  setDataStorage,
  setDataStorageConnectionStatus
} from "../actions";

const initState = {
  connConfig: null,
  connectionStatus: false
};

export default createReducer({
    [setDataStorage]: produce((draft, dataStorage) => {
      draft.connConfig = dataStorage;
    }),
    [setDataStorageConnectionStatus]: produce((draft, status) => {
      draft.connectionStatus = status;
    }),
  },
  initState
);