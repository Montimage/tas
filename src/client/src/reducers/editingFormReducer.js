import { createReducer } from 'redux-act';
import { selectDevice, selectSensor, selectActuator, showModal } from '../actions';

const initState = {
  formID: null,
  selectedDevice: null,
  selectedSensor: null,
  selectedActuator: null,
  dataStorage: null
}
export default createReducer({
  [showModal] : (state, formID) => ({...state, formID}),
  [selectDevice] : (state, selectedDevice) => ({...state, selectedDevice}),
  [selectSensor] : (state, selectedSensor) => ({...state, selectedSensor}),
  [selectActuator] : (state, selectedActuator) => ({...state, selectedActuator})
}, initState);
