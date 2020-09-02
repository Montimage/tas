import { createReducer } from 'redux-act';
import { setDataRecorderStatus } from '../actions';

export default createReducer({
  [setDataRecorderStatus] : (state, status) => status
}, null);
