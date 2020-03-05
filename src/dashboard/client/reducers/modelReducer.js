import { createReducer } from 'redux-act';
import produce from 'immer';

import { saveModelError, saveModelOK, saveModel } from '../actions';

const initState  = {
  savedModel: null,
  fetching: false,
  error: null
}

export default createReducer({
  [saveModel] : (state) => ({...state, fetching: true}),
  [saveModelOK] : produce((draft, model) => {draft.savedModel = model, draft.fetching = false;}),
  [saveModelError] : (state, error) => ({...state, error, fetching: false})
}, initState);
