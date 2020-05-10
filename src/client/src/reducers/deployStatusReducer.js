import { createReducer } from 'redux-act';
import { setDeployStatus } from '../actions';

export default createReducer({
  [setDeployStatus] : (state, status) => status
}, false);
