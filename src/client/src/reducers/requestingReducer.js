import { createReducer } from "redux-act";

import {
  uploadModelOK,
  uploadModel,
  requestModel,
  sendDeployStop,
  sendDeployStart,
  setModel,
  deployStopOK,
  deployStartOK,
  setNotification,
  requestLogs,
  requestLogsOK
} from "../actions";

const initState = false;

export default createReducer(
  {
    [uploadModel]: state => true,
    [requestModel]: state => true,
    [sendDeployStop]: state => true,
    [sendDeployStart]: state => true,
    [setNotification]: state => false,
    [setModel]: state => false,
    [uploadModelOK]: state => false,
    [deployStopOK]: state => false,
    [deployStartOK]: state => false,
    [requestLogs]: state => true,
    [requestLogsOK]: state => false
  },
  initState
);