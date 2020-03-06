import { createReducer } from 'redux-act';
import { selectThing, selectSensor, selectActuator, selectDataStorage, showModal } from '../actions';

const initState = {
  formID: null,
  selectedThing: null,
  selectedSensor: null,
  selectedActuator: null,
  dataStorage: null
}
export default createReducer({
  [showModal] : (state, formID) => ({...state, formID}),
  [selectThing] : (state, selectedThing) => ({...state, selectedThing}),
  [selectSensor] : (state, selectedSensor) => ({...state, selectedSensor}),
  [selectActuator] : (state, selectedActuator) => ({...state, selectedActuator}),
  [selectDataStorage] : (state, dataStorage) => ({...state, dataStorage})
}, initState);
