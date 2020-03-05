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
  setError
} from "../actions";

const initState = false;

export default createReducer(
  {
    [uploadModel]: state => true,
    [requestModel]: state => true,
    [sendDeployStop]: state => true,
    [sendDeployStart]: state => true,
    [setError]: state => false,
    [setModel]: state => false,
    [uploadModelOK]: state => false,
    [deployStopOK]: state => false,
    [deployStartOK]: state => false
  },
  initState
);
