import { createSlice } from '@reduxjs/toolkit';

const editingFormInitialState = {
  formID: null,
  selectedDevice: null,
  selectedSensor: null,
  selectedActuator: null,
  dataStorage: null,
};

export const editingFormSlice = createSlice({
  name: 'editingForm',
  initialState: editingFormInitialState,
  reducers: {
    showModal(state, action) {
      state.formID = action.payload;
    },
    selectDevice(state, action) {
      state.selectedDevice = action.payload;
    },
    selectSensor(state, action) {
      state.selectedSensor = action.payload;
    },
    selectActuator(state, action) {
      state.selectedActuator = action.payload;
    },
  },
});

export const { showModal, selectDevice, selectSensor, selectActuator } =
  editingFormSlice.actions;
