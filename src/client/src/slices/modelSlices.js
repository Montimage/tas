import { createAction, createSlice } from '@reduxjs/toolkit';

import { addNewElementToArray, removeElementFromArray } from '../utils';

// Request triggers: watched by the model sagas and tracked by the global
// `requesting` flag, but no reducer of this domain consumes them.
export const requestAllModels = createAction('REQUEST_ALL_MODELS');
export const requestDeleteModel = createAction('REQUEST_DELETE_MODEL');
export const requestDuplicateModel = createAction('REQUEST_DUPLICATE_MODEL');
export const requestAddNewModel = createAction('REQUEST_ADD_NEW_MODEL');
export const requestUpdateModel = createAction('REQUEST_UPDATE_MODEL');
export const requestModel = createAction('REQUEST_MODEL');
export const uploadModel = createAction('UPLOAD_MODEL');
export const uploadModelOK = createAction('UPLOAD_MODEL_OK');
// Settle-only action: tracked by the global `requesting` flag and dispatched
// by the model saga; no reducer of this domain consumes it.
export const updateModelOK = createAction('UPDATE_MODEL_OK');

const allModelsInitialState = [];

export const allModelsSlice = createSlice({
  name: 'allModels',
  initialState: allModelsInitialState,
  reducers: {
    setAllModels: (state, action) => action.payload,
    deleteModelOK(state, action) {
      const index = state.indexOf(action.payload);
      if (index === -1) {
        console.error('Cannot find model to delete: ', action.payload);
      } else {
        state.splice(index, 1);
      }
    },
    duplicateModelOK(state, action) {
      state.push(action.payload);
    },
    addNewModelOK(state, action) {
      state.push(action.payload);
    },
  },
});

export const {
  setAllModels,
  deleteModelOK,
  duplicateModelOK,
  addNewModelOK,
} = allModelsSlice.actions;

const modelInitialState = { name: 'NewModel' };

export const modelSlice = createSlice({
  name: 'model',
  initialState: modelInitialState,
  reducers: {
    setModel: (state, action) => action.payload,
    resetModel() {
      return modelInitialState;
    },
    changeModelName(state, action) {
      state.name = action.payload;
    },
    addThing(state, action) {
      const thing = action.payload;
      if (state.things) {
        const newThings = addNewElementToArray(state.things, thing);
        state.things = [...newThings];
      } else {
        state.things = [thing];
      }
    },
    deleteThing(state, action) {
      const thingID = action.payload;
      const newThings = removeElementFromArray(state.things, thingID);
      if (newThings) state.things = [...newThings];
    },
    changeStatusThing(state, action) {
      const thingID = action.payload;
      for (let index = 0; index < state.things.length; index++) {
        if (state.things[index].id === thingID) {
          state.things[index].enable = !state.things[index].enable;
          return;
        }
      }
      console.error(`[ERROR] Cannot find the thing ${thingID}`);
    },
    addSimulationSensor(state, action) {
      const { thingID, sensor } = action.payload;
      let foundThing = false;
      if (state.things) {
        for (let index = 0; index < state.things.length; index++) {
          if (state.things[index].id === thingID) {
            foundThing = true;
            const newSensors = addNewElementToArray(
              state.things[index].sensors,
              sensor
            );
            state.things[index].sensors = [...newSensors];
            break;
          }
        }
      }

      if (!foundThing) {
        if (!state.sensors) {
          state.sensors = [];
        }
        // Add to free sensors list
        const newSensors = addNewElementToArray(state.sensors, sensor);
        state.sensors = [...newSensors];
      } else {
        if (state.sensors) {
          const newSensors = removeElementFromArray(state.sensors, sensor.id);
          if (newSensors) state.sensors = [...newSensors];
        }
      }
    },
    addSimulationActuator(state, action) {
      const { thingID, actuator } = action.payload;
      let foundThing = false;
      if (state.things) {
        for (let index = 0; index < state.things.length; index++) {
          if (state.things[index].id === thingID) {
            foundThing = true;
            const newActuators = addNewElementToArray(
              state.things[index].actuators,
              actuator
            );
            state.things[index].actuators = [...newActuators];
            break;
          }
        }
      }

      if (!foundThing) {
        if (!state.actuators) {
          state.actuators = [];
        }
        // Add to free actuators list
        const newActuators = addNewElementToArray(state.actuators, actuator);
        state.actuators = [...newActuators];
      } else {
        if (state.actuators) {
          const newActuators = removeElementFromArray(
            state.actuators,
            actuator.id
          );
          if (newActuators) state.actuators = [...newActuators];
        }
      }
    },
    deleteSimulationSensor(state, action) {
      const { sensorID, thingID } = action.payload;
      if (!thingID) {
        // Remove a free sensors
        const newSensors = removeElementFromArray(state.sensors, sensorID);
        if (newSensors) {
          state.sensors = [...newSensors];
        }
      } else {
        // Remove sensors from a thing
        let foundThing = false;
        for (let index = 0; index < state.things.length; index++) {
          if (state.things[index].id === thingID) {
            foundThing = true;
            const newSensors = removeElementFromArray(
              state.things[index].sensors,
              sensorID
            );
            if (newSensors) {
              state.things[index].sensors = [...newSensors];
            }
            break;
          }
        }
        if (!foundThing) {
          console.log(`[ERROR] Cannot remove ${sensorID} from ${thingID}`);
        }
      }
    },
    changeStatusSensor(state, action) {
      const { sensorID, thingID } = action.payload;
      if (!thingID) {
        // free sensors
        if (state.sensors) {
          for (let index = 0; index < state.sensors.length; index++) {
            if (state.sensors[index].id === sensorID) {
              state.sensors[index].enable = !state.sensors[index].enable;
              return;
            }
          }
        }
        console.log(`[ERROR] Cannot change status of sensor ${sensorID} in ${thingID}`);
      } else {
        // Change the status of a sensor inside a thing
        for (let tIndex = 0; tIndex < state.things.length; tIndex++) {
          if (state.things[tIndex].id === thingID) {
            for (let index = 0; index < state.things[tIndex].sensors.length; index++) {
              if (state.things[tIndex].sensors[index].id === sensorID) {
                state.things[tIndex].sensors[index].enable =
                  !state.things[tIndex].sensors[index].enable;
                return;
              }
            }
            break;
          }
        }
        console.log(`[ERROR] Cannot change status of sensor ${sensorID} in ${thingID}`);
      }
    },
    deleteSimulationActuator(state, action) {
      const { actuatorID, thingID } = action.payload;
      if (!thingID) {
        // Remove a free actuators
        const newActuators = removeElementFromArray(
          state.actuators,
          actuatorID
        );
        if (newActuators) {
          state.actuators = [...newActuators];
        }
      } else {
        // Remove actuators from a thing
        let foundThing = false;
        for (let index = 0; index < state.things.length; index++) {
          if (state.things[index].id === thingID) {
            foundThing = true;
            const newActuators = removeElementFromArray(
              state.things[index].actuators,
              actuatorID
            );
            if (newActuators) {
              state.things[index].actuators = [...newActuators];
            }
            break;
          }
        }
        if (!foundThing) {
          console.log(`[ERROR] Cannot remove ${actuatorID} from ${thingID}`);
        }
      }
    },
    changeStatusActuator(state, action) {
      const { actuatorID, thingID } = action.payload;
      if (!thingID) {
        // free actuator
        if (state.actuators) {
          for (let index = 0; index < state.actuators.length; index++) {
            if (state.actuators[index].id === actuatorID) {
              state.actuators[index].enable = !state.actuators[index].enable;
              return;
            }
          }
        }
        console.log(`[ERROR] Cannot change status of actuator ${actuatorID} in ${thingID}`);
      } else {
        // Change the status of an actuator inside a thing
        for (let tIndex = 0; tIndex < state.things.length; tIndex++) {
          if (state.things[tIndex].id === thingID) {
            for (let index = 0; index < state.things[tIndex].actuators.length; index++) {
              if (state.things[tIndex].actuators[index].id === actuatorID) {
                state.things[tIndex].actuators[index].enable =
                  !state.things[tIndex].actuators[index].enable;
                return;
              }
            }
            break;
          }
        }
        console.log(`[ERROR] Cannot change status of actuator ${actuatorID} in ${thingID}`);
      }
    },
  },
});

export const {
  setModel,
  resetModel,
  changeModelName,
  addThing,
  deleteThing,
  changeStatusThing,
  addSimulationSensor,
  addSimulationActuator,
  deleteSimulationSensor,
  deleteSimulationActuator,
  changeStatusSensor,
  changeStatusActuator,
} = modelSlice.actions;
