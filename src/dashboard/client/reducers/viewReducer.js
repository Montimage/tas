import { createReducer } from 'redux-act';
import produce from 'immer';
import { setView } from '../actions';

export default createReducer({
  [setView] : produce((draft, newView) => draft = newView)
}, 'json');
