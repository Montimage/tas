import { createReducer } from 'redux-act';
import produce from 'immer';
import { setContentType } from '../actions';

export default createReducer({
  [setContentType] : produce((draft, newContentType) => draft = newContentType)
}, 'model');
