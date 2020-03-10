import { createReducer } from "redux-act";
import produce from "immer";
import {
  setModel,
  resetModel,
  addThing,
  deleteThing,
  addSimulationSensor,
  addDGSensor,
  addDGActuator,
  deleteSimulationSensor,
  deleteDGSensor,
  deleteDGActuator,
  addSimulationActuator,
  deleteSimulationActuator,
  updateDataStorage
} from "../actions";
import { addNewElementToArray, removeElementFromArray } from "../utils";

const initState = { name: "NewModel" };

export default createReducer(
  {
    [setModel]: produce((draft, model) => (draft = model)),
    [resetModel]: state => initState,
    // Simulation
    [addThing]: produce((draft, thing) => {
      if (draft.things) {
        const newThings = addNewElementToArray(draft.things, thing);
        draft.things = [...newThings];
      } else {
        draft.things = [thing];
      }
    }),
    [deleteThing]: produce((draft, thingID) => {
      const newThings = removeElementFromArray(draft.things, thingID);
      if (newThings) draft.things = [...newThings];
    }),
    [addSimulationSensor]: produce((draft, { thingID, sensor }) => {
      let foundThing = false;
      if (draft.things) {
        for (let index = 0; index < draft.things.length; index++) {
          if (draft.things[index].id === thingID) {
            foundThing = true;
            const newSensors = addNewElementToArray(
              draft.things[index].sensors,
              sensor
            );
            draft.things[index].sensors = [...newSensors];
            break;
          }
        }
      }

      if (!foundThing) {
        if (!draft.sensors) {
          draft.sensors = [];
        }
        // Add to free sensors list
        const newSensors = addNewElementToArray(draft.sensors, sensor);
        draft.sensors = [...newSensors];
      } else {
        if (draft.sensors) {
          const newSensors = removeElementFromArray(draft.sensors, sensor.id);
          if (newSensors) draft.sensors = [...newSensors];
        }
      }
    }),
    [addSimulationActuator]: produce((draft, { thingID, actuator }) => {
      let foundThing = false;
      if (draft.things) {
        for (let index = 0; index < draft.things.length; index++) {
          if (draft.things[index].id === thingID) {
            foundThing = true;
            const newActuators = addNewElementToArray(
              draft.things[index].actuators,
              actuator
            );
            draft.things[index].actuators = [...newActuators];
            break;
          }
        }
      }

      if (!foundThing) {
        if (!draft.actuators) {
          draft.actuators = [];
        }
        // Add to free actuators list
        const newActuators = addNewElementToArray(draft.actuators, actuator);
        draft.actuators = [...newActuators];
      } else {
        if (draft.actuators) {
          const newActuators = removeElementFromArray(
            draft.actuators,
            actuator.id
          );
          if (newActuators) draft.actuators = [...newActuators];
        }
      }
    }),
    [deleteSimulationSensor]: produce((draft, { sensorID, thingID }) => {
      if (!thingID) {
        // Remove a free sensors
        const newSensors = removeElementFromArray(draft.sensors, sensorID);
        if (newSensors) {
          draft.sensors = [...newSensors];
        }
      } else {
        // Remove sensors from a thing
        let foundThing = false;
        for (let index = 0; index < draft.things.length; index++) {
          if (draft.things[index].id === thingID) {
            foundThing = true;
            const newSensors = removeElementFromArray(
              draft.things[index].sensors,
              sensorID
            );
            if (newSensors) {
              draft.things[index].sensors = [...newSensors];
            }
            break;
          }
        }
        if (!foundThing) {
          console.log(`[ERROR] Cannot remove ${sensorID} from ${thingID}`);
        }
      }
    }),
    [deleteSimulationActuator]: produce((draft, { actuatorID, thingID }) => {
      if (!thingID) {
        // Remove a free actuators
        const newActuators = removeElementFromArray(
          draft.actuators,
          actuatorID
        );
        if (newActuators) {
          draft.actuators = [...newActuators];
        }
      } else {
        // Remove actuators from a thing
        let foundThing = false;
        for (let index = 0; index < draft.things.length; index++) {
          if (draft.things[index].id === thingID) {
            foundThing = true;
            const newActuators = removeElementFromArray(
              draft.things[index].actuators,
              actuatorID
            );
            if (newActuators) {
              draft.things[index].actuators = [...newActuators];
            }
            break;
          }
        }
        if (!foundThing) {
          console.log(`[ERROR] Cannot remove ${actuatorID} from ${thingID}`);
        }
      }
    }),
    // Data-generator
    [addDGSensor]: produce((draft, sensor) => {
      if (draft.sensors) {
        const newSensors = addNewElementToArray(draft.sensors, sensor);
        draft.sensors = [...newSensors];
      } else {
        draft.sensors = [sensor];
      }
    }),
    [deleteDGSensor]: produce((draft, sensorID) => {
      const newSensors = removeElementFromArray(draft.sensors, sensorID);
      if (newSensors) draft.sensors = [...newSensors];
    }),
    [addDGActuator]: produce((draft, actuator) => {
      if (draft.actuators) {
        const newActuators = addNewElementToArray(draft.actuators, actuator);
        draft.actuators = [...newActuators];
      } else {
        draft.actuators = [actuator];
      }
    }),
    [deleteDGActuator]: produce((draft, actuatorID) => {
      const newActuators = removeElementFromArray(draft.actuators, actuatorID);
      if (newActuators) draft.actuators = [...newActuators];
    }),
    [updateDataStorage]: (state, dataStorage) => ({
      ...state,
      dbConfig: dataStorage
    })
  },
  initState
);

// export const deleteDGSensor = createAction('DELETE_DATA_GENERATOR_SENSOR');
// export const deleteDGActuator = createAction('DELETE_DATA_GENERATOR_ACTUATOR');
