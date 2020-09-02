import { createReducer } from 'redux-act';
import { setSimulationStatus } from '../actions';

export default createReducer({
  [setSimulationStatus] : (state, status) => status
}, false);
