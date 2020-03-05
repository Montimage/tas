import {createAction } from 'redux-act';

// Load Model
export const requestModel = createAction('REQUEST_MODEL');
export const setModel = createAction('SET_MODEL');
export const setError = createAction('SET_ERROR');

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

// LeftSide menu
export const showModal = createAction('SHOW_MODAL');