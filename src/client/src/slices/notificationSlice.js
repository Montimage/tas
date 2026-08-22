import { createSlice } from '@reduxjs/toolkit';

import {
  addThing,
  deleteThing,
  addSimulationSensor,
  deleteSimulationActuator,
  addSimulationActuator,
  deleteSimulationSensor,
} from './modelSlices';

export const notificationSlice = createSlice({
  name: 'notify',
  initialState: null,
  reducers: {
    setNotification: (state, action) => {
      const { type, message } = action.payload;
      if (message !== {}) {
        return { type, message };
      } else {
        return null;
      }
    },
    resetNotification: () => null,
  },
  extraReducers: (builder) => {
    builder
      .addCase(addThing, (state, action) => ({
        type: 'success',
        message: `Thing ${action.payload.id} has been added!`,
      }))
      .addCase(deleteThing, (state, action) => ({
        type: 'success',
        message: `Thing ${action.payload} has been removed!`,
      }))
      .addCase(addSimulationSensor, (state, action) => {
        const { sensor, thingID } = action.payload;
        return {
          type: 'success',
          message: `Sensor ${sensor.id} has been added ${thingID ? `into Thing ${thingID}` : ''}!`,
        };
      })
      .addCase(deleteSimulationSensor, (state, action) => {
        const { sensorID, thingID } = action.payload;
        return {
          type: 'success',
          message: `Sensor ${sensorID} has been removed${thingID ? `from Thing ${thingID}` : ''}!`,
        };
      })
      .addCase(addSimulationActuator, (state, action) => {
        const { actuator, thingID } = action.payload;
        return {
          type: 'success',
          message: `Actuator ${actuator.id} has been added ${thingID ? `into Thing ${thingID}` : ''}!`,
        };
      })
      .addCase(deleteSimulationActuator, (state, action) => {
        const { actuatorID, thingID } = action.payload;
        return {
          type: 'success',
          message: `Actuator ${actuatorID} has been removed${thingID ? `from Thing ${thingID}` : ''}!`,
        };
      });
  },
});

export const { setNotification, resetNotification } = notificationSlice.actions;
