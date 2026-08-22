import { createAction, createSlice } from '@reduxjs/toolkit';

// Request triggers: watched by the simulation saga and tracked by the
// global `requesting` flag, but no reducer of this domain consumes them.
export const requestStartSimulation = createAction('REQUEST_START_SIMULATION');
export const requestStopSimulation = createAction('REQUEST_STOP_SIMULATION');
export const requestSimulationStatus = createAction('REQUEST_SIMULATION_STATUS');

export const simulationStatusSlice = createSlice({
  name: 'simulationStatus',
  initialState: false,
  reducers: {
    setSimulationStatus: (state, action) => action.payload,
  },
});

export const { setSimulationStatus } = simulationStatusSlice.actions;
