import {createAction } from 'redux-act';
// Notification
export const setNotification = createAction('SET_NOTIFICATION');
export const resetNotification = createAction('RESET_NOTIFICATION');

// Model
export const requestModel = createAction('REQUEST_MODEL');
export const setModel = createAction('SET_MODEL');
// Model - Simulation
export const addThing = createAction('ADD_THING');
export const deleteThing = createAction('DELETE_THING');
export const addSimulationSensor = createAction('ADD_SIMULATION_SENSOR');
export const addSimulationActuator = createAction('ADD_SIMULATION_ACTUATOR');
export const deleteSimulationSensor = createAction('DELETE_SIMULATION_SENSOR');
export const deleteSimulationActuator = createAction('DELETE_SIMULATION_ACTUATOR');
// Model - Data - generator
export const addDGSensor = createAction('ADD_DATA_GENERATOR_SENSOR');
export const addDGActuator = createAction('ADD_DATA_GENERATOR_ACTUATOR');
export const deleteDGSensor = createAction('DELETE_DATA_GENERATOR_SENSOR');
export const deleteDGActuator = createAction('DELETE_DATA_GENERATOR_ACTUATOR');
export const updateDataStorage = createAction('UPDATE_DATA_STORAGE');
// Save Model to Server
export const uploadModel = createAction('UPLOAD_MODEL');
export const uploadModelOK = createAction('UPLOAD_MODEL_OK');

// Control the Simulation
export const sendDeployStart = createAction('SEND_DEPLOY_START');
export const deployStartOK = createAction('DEPLOY_START_OK');
export const sendDeployStop = createAction('SEND_DEPLOY_STOP');
export const deployStopOK = createAction('DEPLOY_STOP_OK');

// Control the logs
export const requestLogs = createAction('REQUEST_LOGS');
export const requestLogsOK = createAction('REQUEST_LOGS_OK');

// Control the view
export const setViewType = createAction('SET_VIEW_TYPE');
export const setContentType = createAction('SET_CONTENT_TYPE');

// Import Model
export const resetModel = createAction('RESET_MODEL');

// Tool
export const changeTool = createAction('CHANGE_TOOL');

// editing forms
export const showModal = createAction('SHOW_MODAL');
export const selectThing = createAction('SELECT_THING');
export const selectSensor = createAction('SELECT_SENSOR');
export const selectActuator = createAction('SELECT_ACTUATOR');
export const selectDataStorage = createAction('SELECT_DATA_STORAGE');

