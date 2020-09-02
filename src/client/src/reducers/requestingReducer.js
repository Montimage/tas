import { createReducer } from "redux-act";

import {
  uploadModelOK,
  uploadModel,
  requestModel,
  setModel,
  setNotification,
  requestLogFile,
  requestLogFileOK,
  requestAllModels,
  deleteModelOK,
  setAllModels,
  requestDuplicateModel,
  duplicateModelOK,
  requestDeleteModel,
  requestAddNewModel,
  addNewModelOK,
  requestUpdateModel,
  updateModelOK,
  requestDataStorage,
  requestUpdateDataStorage,
  setDataStorage,
  requestTestDataStorageConnection,
  setDataStorageConnectionStatus
} from "../actions";

const initState = false;

export default createReducer(
  {
    [uploadModel]: state => true,
    [requestModel]: state => true,
    // [sendDeployStop]: state => true,
    // [sendDeployStart]: state => true,
    [setNotification]: state => false,
    [setModel]: state => false,
    [uploadModelOK]: state => false,
    // [deployStopOK]: state => false,
    // [deployStartOK]: state => false,
    [requestLogFile]: state => true,
    [requestLogFileOK]: state => false,
    [requestAllModels]: state => true,
    [setAllModels]: state => false,
    [requestDeleteModel]: state => true,
    [deleteModelOK]: state => false,
    [requestDuplicateModel]: state => true,
    [duplicateModelOK]: state => false,
    [requestAddNewModel]: state => true,
    [addNewModelOK]: state => false,
    [requestUpdateModel]: state => true,
    [updateModelOK]: state => false,
    [requestDataStorage]: state => true,
    [requestUpdateDataStorage]: state => true,
    [setDataStorage]: state => false,
    [requestTestDataStorageConnection]: state => true,
    [setDataStorageConnectionStatus]: state => false,
  },
  initState
);
