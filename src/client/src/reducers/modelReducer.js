import { createReducer } from "redux-act";
import produce from "immer";
import {
  setModel,
  resetModel,
  changeModelName,
  addThing,
  deleteThing,
  changeStatusThing,
  addSimulationSensor,
  deleteSimulationSensor,
  changeStatusSensor,
  addSimulationActuator,
  deleteSimulationActuator,
  changeStatusActuator,
} from "../actions";
import { addNewElementToArray, removeElementFromArray } from "../utils";

const initState = { name: "NewModel" };

export default createReducer(
  {
    [setModel]: produce((draft, model) => (draft = model)),
    [resetModel]: state => initState,
    // modification
    [changeModelName]: produce((draft, newName) => {
      draft.name = newName;
    }),
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
    [changeStatusThing]: produce((draft, thingID) => {
      for (let index = 0; index < draft.things.length; index++) {
        if (draft.things[index].id === thingID) {
          draft.things[index].enable = !draft.things[index].enable;
          return;
        };
      }
      console.error(`[ERROR] Cannot find the thing ${thingID}`);
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
    [changeStatusSensor]: produce((draft, { sensorID, thingID }) => {
      if (!thingID) {
        // free sensors
        if (draft.sensors) {
          for (let index = 0; index < draft.sensors.length; index++) {
            if (draft.sensors[index].id === sensorID) {
              draft.sensors[index].enable = !draft.sensors[index].enable;
              return;
            }
          }
        }
        console.log(`[ERROR] Cannot change status of sensor ${sensorID} in ${thingID}`);
      } else {
        // Remove sensors from a thing
        for (let tIndex = 0; tIndex < draft.things.length; tIndex++) {
          if (draft.things[tIndex].id === thingID) {
            for (let index = 0; index < draft.things[tIndex].sensors.length; index++) {
              if (draft.things[tIndex].sensors[index].id === sensorID) {
                draft.things[tIndex].sensors[index].enable = !draft.things[tIndex].sensors[index].enable;
                return;
              }
            }
            break;
          }
        }
        console.log(`[ERROR] Cannot change status of sensor ${sensorID} in ${thingID}`);
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
    }),[changeStatusActuator]: produce((draft, { actuatorID, thingID }) => {
      if (!thingID) {
        // free actuator
        if (draft.actuators) {
          for (let index = 0; index < draft.actuators.length; index++) {
            if (draft.actuators[index].id === actuatorID) {
              draft.actuators[index].enable = !draft.actuators[index].enable;
              return;
            }
          }
        }
        console.log(`[ERROR] Cannot change status of actuator ${actuatorID} in ${thingID}`);
      } else {
        // Remove sensors from a thing
        for (let tIndex = 0; tIndex < draft.things.length; tIndex++) {
          if (draft.things[tIndex].id === thingID) {
            for (let index = 0; index < draft.things[tIndex].actuators.length; index++) {
              if (draft.things[tIndex].actuators[index].id === actuatorID) {
                draft.things[tIndex].actuators[index].enable = !draft.things[tIndex].actuators[index].enable;
                return;
              }
            }
            break;
          }
        }
        console.log(`[ERROR] Cannot change status of actuator ${actuatorID} in ${thingID}`);
      }
    })
  },
  initState
);