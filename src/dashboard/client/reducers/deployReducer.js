import { createReducer } from 'redux-act';

import { sendDeployStart, sendDeployStop, deployStartOK, deployStartFailed, deployStopOK, deployStopFailed } from '../actions';

const initState  = {
  isExecuting: null,
  requesting: false,
  error: null
}

export default createReducer({
  [sendDeployStart] : (state) => ({...state, requesting: true}),
  [sendDeployStop] : (state) => ({...state, requesting: true}),
  [deployStartOK] : (state) => ({...state, requesting: false, isExecuting: true}),
  [deployStopOK] : (state) => ({...state, requesting: false, isExecuting: false}),
  [deployStartFailed] : (state, error) => ({...state, error, requesting: false}),
  [deployStopFailed] : (state, error) => ({...state, error, requesting: false}),
}, initState);
