import { createReducer } from 'redux-act';
import produce from 'immer';

import { loadModel, setModel, setError, importModel, resetEditor } from '../actions';

const initState  = {
  model: {
    name: 'NewModel'
  },
  fetching: false,
  error: null
}

export default createReducer({
  [loadModel] : (state) => ({...state, fetching: true}),
  [setModel] : produce((draft, model) => {draft.model = model ; draft.fetching = false}),
  [setError] : (state, error) => ({...state, error, fetching: false}),
  [importModel]: (state) => {console.log('Going to import model'); return state;},
  [resetEditor] : produce((state) => initState),
}, initState)