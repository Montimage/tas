import {createAction } from 'redux-act';
// Notification
export const setNotification = createAction('SET_NOTIFICATION');
export const resetNotification = createAction('RESET_NOTIFICATION');

// Model
export const requestModel = createAction('REQUEST_MODEL');
export const setModel = createAction('SET_MODEL');
// Model - modification
export const changeModelName = createAction('CHANGE_MODEL_NAME');
export const addThing = createAction('ADD_THING');
export const deleteThing = createAction('DELETE_THING');
export const addSimulationSensor = createAction('ADD_SIMULATION_SENSOR');
export const addSimulationActuator = createAction('ADD_SIMULATION_ACTUATOR');
export const deleteSimulationSensor = createAction('DELETE_SIMULATION_SENSOR');
export const deleteSimulationActuator = createAction('DELETE_SIMULATION_ACTUATOR');
export const changeStatusSensor = createAction('CHANGE_STATUS_SENSOR');
export const changeStatusActuator = createAction('CHANGE_STATUS_ACTUATOR');
// Save Model to Server
export const uploadModel = createAction('UPLOAD_MODEL');
export const uploadModelOK = createAction('UPLOAD_MODEL_OK');

// Control the Simulation
export const sendDeployStart = createAction('SEND_DEPLOY_START');
export const deployStartOK = createAction('DEPLOY_START_OK');
export const sendDeployStop = createAction('SEND_DEPLOY_STOP');
export const deployStopOK = createAction('DEPLOY_STOP_OK');
export const requestDeployStatus = createAction('REQUEST_DEPLOY_STATUS');
export const setDeployStatus = createAction('SET_DEPLOY_STATUS');

// Control the logs
export const requestLogs = createAction('REQUEST_LOGS');
export const requestLogFiles = createAction('REQUEST_LOGFILES');
export const requestLogsOK = createAction('REQUEST_LOGS_OK');
export const requestLogFilesOK = createAction('REQUEST_LOGFILES_OK');
export const requestDeleteLogFile = createAction('REQUEST_DELETE_LOG_FILE');

// Import Model
export const resetModel = createAction('RESET_MODEL');

// editing forms
export const showModal = createAction('SHOW_MODAL');
export const selectThing = createAction('SELECT_THING');
export const changeStatusThing = createAction('CHANGE_STATUS_THING');
export const selectSensor = createAction('SELECT_SENSOR');
export const selectActuator = createAction('SELECT_ACTUATOR');
export const selectDataStorage = createAction('SELECT_DATA_STORAGE');

