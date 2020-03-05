import {createAction } from 'redux-act';

import {
  MODELS
} from '../constants';

// Load Model
export const loadModel = createAction(MODELS.LOAD);
export const setModel = createAction(MODELS.LOAD_OK);
export const setError = createAction(MODELS.LOAD_FAILED);

// Save Model to Server
export const saveModel = createAction(MODELS.SAVE);
export const saveModelOK = createAction(MODELS.SAVE_OK);
export const saveModelError = createAction(MODELS.SAVE_FAILED);

// Control the Simulation
export const sendDeployStart = createAction('SEND_DEPLOY_START');
export const deployStartOK = createAction('DEPLOY_START_OK');
export const deployStartFailed = createAction('DEPLOY_START_FAILED');
export const sendDeployStop = createAction('SEND_DEPLOY_STOP');
export const deployStopOK = createAction('DEPLOY_STOP_OK');
export const deployStopFailed = createAction('DEPLOY_STOP_FAILED');

// Control the logs
export const sendViewLogs = createAction('SEND_VIEW_LOGS');
export const viewLogsOK = createAction('VIEW_LOGS_OK');
export const viewLogsFailed = createAction('VIEW_LOGS_FAILED');

// Control the view
export const setView = createAction('SET_VIEW');
export const setContentType = createAction('SET_CONTENT_TYPE');

// Import Model
export const importModel = createAction(MODELS.IMPORT_MODEL);
export const exportModel = createAction('EXPORT_MODEL');
export const resetEditor = createAction('RESET_EDITOR');

// LeftSide menu
export const showModal = createAction('SHOW_MODAL');