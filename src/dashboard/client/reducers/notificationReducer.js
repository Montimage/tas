import { createReducer } from "redux-act";
import {
  setNotification,
  resetNotification,
  addThing,
  deleteThing,
  addSimulationSensor,
  addSimulationActuator,
  deleteSimulationSensor,
  deleteSimulationActuator,
  addDGSensor,
  addDGActuator,
  deleteDGSensor,
  deleteDGActuator,
  updateDataStorage
} from "../actions";

export default createReducer(
  {
    [setNotification]: (state, { type, message }) => ({ type, message }),
    [resetNotification]: state => null,
    [addThing]: (state, thing) => ({
      type: "success",
      message: `Thing ${thing.id} has been added!`
    }),
    [deleteThing]: (state, thingID) => ({
      type: "success",
      message: `Thing ${thingID} has been removed!`
    }),
    [addSimulationSensor]: (state, {sensor, thingID}) => ({
      type: "success",
      message: `Sensor ${sensor.id} has been added ${thingID? `into Thing ${thingID}`: ''}!`
    }),
    [deleteSimulationSensor]: (state, {sensorID, thingID}) => ({
      type: "success",
      message: `Sensor ${sensorID} has been removed${thingID? `from Thing ${thingID}`: ''}!`
    }),
    [addSimulationActuator]: (state, {actuator, thingID}) => ({
      type: "success",
      message: `Actuator ${actuator.id} has been added ${thingID? `into Thing ${thingID}`: ''}!`
    }),
    [deleteSimulationActuator]: (state, {actuatorID, thingID}) => ({
      type: "success",
      message: `Actuator ${actuatorID} has been removed${thingID? `from Thing ${thingID}`: ''}!`
    }),
    [addDGSensor]: (state, sensor) => ({
      type: "success",
      message: `Sensor ${sensor.id} has been added!`
    }),
    [deleteDGSensor]: (state, sensorID) => ({
      type: "success",
      message: `Sensor ${sensorID} has been removed!`
    }),
    [addDGActuator]: (state, actuator) => ({
      type: "success",
      message: `Actuator ${actuator.id} has been added!`
    }),
    [deleteDGActuator]: (state, actuatorID) => ({
      type: "success",
      message: `Actuator ${actuatorID} has been removed!`
    }),
    [updateDataStorage]: (state, dataStorage) => ({
      type: "success",
      message: `Data Storage has been updated!`
    })
  },
  null
);
