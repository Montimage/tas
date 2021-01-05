import {createAction } from 'redux-act';
// Notification
export const setNotification = createAction('SET_NOTIFICATION');
export const resetNotification = createAction('RESET_NOTIFICATION');

// All Models
export const requestAllModels = createAction('REQUEST_ALL_MODELS');
export const setAllModels = createAction('SET_ALL_MODELS');
export const requestDeleteModel = createAction('REQUEST_DELETE_MODEL');
export const requestDuplicateModel = createAction('REQUEST_DUPLICATE_MODEL');
export const deleteModelOK = createAction('DELETE_MODEL_OK');
export const duplicateModelOK = createAction('DUPLICATE_MODEL_OK');
export const requestAddNewModel = createAction('REQUEST_ADD_NEW_MODEL');
export const addNewModelOK = createAction('ADD_NEW_MODEL_OK');
export const requestUpdateModel = createAction('REQUEST_UPDATE_MODEL');
// Model detail
export const updateModelOK = createAction('UPDATE_MODEL_OK');
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
export const resetModel = createAction('RESET_MODEL');
// Save Model to Server
export const uploadModel = createAction('UPLOAD_MODEL');
export const uploadModelOK = createAction('UPLOAD_MODEL_OK');

export const requestAllDataRecorders = createAction('REQUEST_ALL_DATA_RECORDERS');
export const setAllDataRecorders = createAction('SET_ALL_DATA_RECORDERS');
export const requestDeleteDataRecorder = createAction('REQUEST_DELETE_DATA_RECORDER');
export const requestDuplicateDataRecorder = createAction('REQUEST_DUPLICATE_DATA_RECORDER');
export const deleteDataRecorderOK = createAction('DELETE_DATA_RECORDER_OK');
export const duplicateDataRecorderOK = createAction('DUPLICATE_DATA_RECORDER_OK');
export const requestAddNewDataRecorder = createAction('REQUEST_ADD_NEW_DATA_RECORDER');
export const addNewDataRecorderOK = createAction('ADD_NEW_DATA_RECORDER_OK');
export const requestUpdateDataRecorder = createAction('REQUEST_UPDATE_DATA_RECORDER');
export const updateDataRecorderOK = createAction('UPDATE_DATA_RECORDER_OK');
export const requestDataRecorder = createAction('REQUEST_DATA_RECORDER');
export const setDataRecorder = createAction('SET_DATA_RECORDER');
export const changeDataRecorderName = createAction('CHANGE_DATA_RECORDER_NAME');
export const resetDataRecorder = createAction('RESET_DATA_RECORDER');
export const requestStartDataRecorder = createAction('REQUEST_START_DATA_RECORDER');
export const requestStopDataRecorder = createAction('REQUEST_STOP_DATA_RECORDER');
export const requestDataRecorderStatus = createAction('REQUEST_DATA_RECORDER_STATUS');
export const setDataRecorderStatus = createAction('SET_DATA_RECORDER_STATUS');

// Control the Simulation
// export const sendDeployStart = createAction('SEND_DEPLOY_START');
// export const deployStartOK = createAction('DEPLOY_START_OK');
// export const sendDeployStop = createAction('SEND_DEPLOY_STOP');
// export const deployStopOK = createAction('DEPLOY_STOP_OK');
// export const requestDeployStatus = createAction('REQUEST_DEPLOY_STATUS');

// Control the logs
export const requestAllLogFiles = createAction('REQUEST_ALL_LOG_FILES');
export const requestAllLogFilesOK = createAction('REQUEST_ALL_LOG_FILES_OK');
export const requestLogFile = createAction('REQUEST_LOG_FILE');
export const requestLogFileOK = createAction('REQUEST_LOG_FILE_OK');
export const requestDeleteLogFile = createAction('REQUEST_DELETE_LOG_FILE');
export const requestDeleteLogFileOK = createAction('REQUEST_DELETE_LOG_FILE_OK');

// editing forms
export const showModal = createAction('SHOW_MODAL');
export const selectDevice = createAction('SELECT_DEVICE');
export const changeStatusThing = createAction('CHANGE_STATUS_THING');
export const selectSensor = createAction('SELECT_SENSOR');
export const selectActuator = createAction('SELECT_ACTUATOR');
export const selectDataStorage = createAction('SELECT_DATA_STORAGE');


// Statistics
export const requestStats = createAction('REQUEST_STATS');
export const requestStatsOK = createAction('REQUEST_STATS_OK');

// Data storage
export const requestDataStorage = createAction('REQUEST_DATA_STORAGE');
export const requestUpdateDataStorage = createAction('REQUEST_UPDATE_DATA_STORAGE');
export const setDataStorage = createAction('SET_DATA_STORAGE');
export const requestTestDataStorageConnection = createAction('REQUEST_TEST_DATA_STORAGE_CONNECTION');
export const setDataStorageConnectionStatus = createAction('SET_DATA_STORAGE_CONNECTION_STATUS');


// Test Campaigns
export const requestAllTestCampaigns = createAction('REQUEST_ALL_TEST_CAMPAIGNS');
export const setAllTestCampaigns = createAction('SET_ALL_TEST_CAMPAIGNS');
export const setCurrentTestCampaign = createAction('SET_CURRENT_TEST_CAMPAIGN');
export const requestDeleteTestCampaign = createAction('REQUEST_DELETE_TEST_CAMPAIGN');
export const deleteTestCampaignOK = createAction('DELETE_TEST_CAMPAIGN_OK');
export const requestAddNewTestCampaign = createAction('REQUEST_ADD_NEW_TEST_CAMPAIGN');
export const addNewTestCampaignOK = createAction('ADD_NEW_TEST_CAMPAIGN_OK');
export const requestTestCampaign = createAction('REQUEST_TEST_CAMPAIGN');
export const requestUpdateTestCampaign = createAction('REQUEST_UPDATE_TEST_CAMPAIGN');
export const updateTestCampaignOK = createAction('UPDATE_TEST_CAMPAIGN_OK');
// Manage devops
export const requestLaunchTestCampaign = createAction('REQUEST_LAUNCH_TEST_CAMPAIGN');
export const requestStopTestCampaign = createAction('REQUEST_STOP_TEST_CAMPAIGN');
export const requestTestCampaignStatus = createAction('REQUEST_TEST_CAMPAIGN_STATUS');
export const setTestCampaignRunningStatus = createAction('SET_TEST_CAMPAIGN_RUNNING_STATUS');

// Test cases
export const requestAllTestCases = createAction('REQUEST_ALL_TEST_CASES');
export const setAllTestCases = createAction('SET_ALL_TEST_CASES');
export const setCurrentTestCase = createAction('SET_CURRENT_TEST_CASE');
export const requestDeleteTestCase = createAction('REQUEST_DELETE_TEST_CASE');
export const deleteTestCaseOK = createAction('DELETE_TEST_CASE_OK');
export const requestAddNewTestCase = createAction('REQUEST_ADD_NEW_TEST_CASE');
export const addNewTestCaseOK = createAction('ADD_NEW_TEST_CASE_OK');
export const requestTestCase = createAction('REQUEST_TEST_CASE');
export const requestUpdateTestCase = createAction('REQUEST_UPDATE_TEST_CASE');
export const updateTestCaseOK = createAction('UPDATE_TEST_CASE_OK');


// Dataset
export const requestAllDatasets = createAction('REQUEST_ALL_DATA_SETS');
export const setAllDatasets = createAction('SET_ALL_DATA_SETS');
export const setCurrentDataset = createAction('SET_CURRENT_DATA_SET');
export const requestDeleteDataset = createAction('REQUEST_DELETE_DATA_SET');
export const deleteDatasetOK = createAction('DELETE_DATA_SET_OK');
export const requestAddNewDataset = createAction('REQUEST_ADD_NEW_DATA_SET');
export const addNewDatasetOK = createAction('ADD_NEW_DATA_SET_OK');
export const requestDataset = createAction('REQUEST_DATA_SET');
export const requestUpdateDataset = createAction('REQUEST_UPDATE_DATA_SET');
export const updateDatasetOK = createAction('UPDATE_DATA_SET_OK');

// Event
export const requestEventsByDatasetId = createAction('REQUEST_EVENTS_BY_DATASET_ID');
export const setEvents = createAction('SET_EVENTS');
export const setTotalNumberEvents = createAction('SET_TOTAL_NUMBER_EVENTS');
export const requestDeleteEvent = createAction('REQUEST_DELETE_EVENT');
export const deleteEventOK = createAction('DELETE_EVENT_OK');
export const requestAddNewEvent = createAction('REQUEST_ADD_NEW_EVENT');
export const addNewEventOK = createAction('ADD_NEW_EVENT_OK');
export const requestEvent = createAction('REQUEST_EVENT');
export const requestUpdateEvent = createAction('REQUEST_UPDATE_EVENT');
export const updateEventOK = createAction('UPDATE_EVENT_OK');

// Simulation
export const requestStartSimulation = createAction('REQUEST_START_SIMULATION');
export const requestStopSimulation = createAction('REQUEST_STOP_SIMULATION');
export const requestSimulationStatus = createAction('REQUEST_SIMULATION_STATUS');
export const setSimulationStatus = createAction('SET_SIMULATION_STATUS');

// Devops
export const requestDevops = createAction('REQUEST_DEVOPS');
export const requestUpdateDevops = createAction('REQUEST_UPDATE_DEVOPS');
export const setDevops = createAction('SET_DEVOPS');


// Reports
export const requestAllReports = createAction('REQUEST_ALL_REPORTS');
export const requestReport = createAction('REQUEST_REPORT');
export const setAllReports = createAction('SET_ALL_REPORTS');
export const setCurrentReport = createAction('SET_CURRENT_REPORT');
export const requestUpdateReport = createAction('REQUEST_UPDATE_REPORT');
export const updateReportOK = createAction('UPDATE_REPORT_OK');
export const requestDeleteReport = createAction('REQUEST_DELETE_REPORT');
export const deleteReportOK = createAction('DELETE_REPORT_OK');
export const requestOriginalEvents = createAction('REQUEST_ORIGINAL_EVENTS');
export const setOriginalEvents = createAction('SET_ORIGINAL_EVENTS');
export const requestNewEvents = createAction('REQUEST_NEW_EVENTS');
export const setNewEvents = createAction('SET_NEW_EVENTS');