import { createReducer } from 'redux-act';
import { setViewType, setContentType } from '../actions';

const initState = {
  contentType: 'model',
  viewType: 'json'
}
export default createReducer({
  [setViewType] : (state, vType) => ({...state, viewType: vType}),
  [setContentType] : (state, cType) => ({...state, contentType: cType}),
}, initState);
