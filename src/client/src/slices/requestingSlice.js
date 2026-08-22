import { createReducer } from '@reduxjs/toolkit';

import * as models from './modelSlices';
import * as recorders from './dataRecorderSlices';
import * as storage from './dataStorageSlice';
import * as logs from './logsSlice';
import * as stats from './statsSlice';
import * as simulation from './simulationSlice';
import * as campaigns from './testCampaignsSlice';
import * as devops from './devopsSlice';
import * as testCases from './testCasesSlice';
import * as datasets from './datasetsSlice';
import * as reports from './reportsSlice';
import * as notify from './notificationSlice';

/**
 * The per-request loading flag is one boolean shared by the whole app: every
 * resource repeats the identical lifecycle - a request/mutation action
 * switches it on, the matching settle action switches it off. Declaring the
 * two sides as flat lists here expresses that pattern exactly once; the
 * factory expands them into concrete reducer cases.
 */
const REQUEST_STARTED = [
  // Models
  models.requestAllModels, models.requestModel, models.requestDeleteModel,
  models.requestDuplicateModel, models.requestAddNewModel, models.requestUpdateModel,
  models.uploadModel,
  // Data recorders
  recorders.requestAllDataRecorders, recorders.requestDeleteDataRecorder,
  recorders.requestDuplicateDataRecorder, recorders.requestAddNewDataRecorder,
  recorders.requestUpdateDataRecorder, recorders.requestDataRecorder,
  recorders.changeDataRecorderName, recorders.requestStartDataRecorder,
  recorders.requestStopDataRecorder, recorders.requestDataRecorderStatus,
  // Data storage
  storage.requestDataStorage, storage.requestUpdateDataStorage,
  storage.requestTestDataStorageConnection,
  // Logs / statistics
  logs.requestLogFile, logs.requestAllLogFiles, logs.requestDeleteLogFile,
  stats.requestStats,
  // Test campaigns
  campaigns.requestAllTestCampaigns, campaigns.requestDeleteTestCampaign,
  campaigns.requestAddNewTestCampaign, campaigns.requestTestCampaign,
  campaigns.requestUpdateTestCampaign, campaigns.requestLaunchTestCampaign,
  campaigns.requestStopTestCampaign,
  // Test cases
  testCases.requestAllTestCases, testCases.requestTestCase,
  testCases.requestDeleteTestCase, testCases.requestAddNewTestCase,
  testCases.requestUpdateTestCase,
  // Datasets & events
  datasets.requestAllDatasets, datasets.requestDataset,
  datasets.requestDeleteDataset, datasets.requestAddNewDataset,
  datasets.requestUpdateDataset, datasets.requestEventsByDatasetId,
  datasets.requestDeleteEvent, datasets.requestAddNewEvent,
  datasets.requestUpdateEvent,
  // Simulation / devops
  simulation.requestStartSimulation, simulation.requestStopSimulation,
  devops.requestDevops, devops.requestUpdateDevops,
  // Reports
  reports.requestAllReports, reports.requestReport, reports.requestUpdateReport,
  reports.requestDeleteReport, reports.requestOriginalEvents,
  reports.requestNewEvents,
];

const REQUEST_FINISHED = [
  // Models
  models.setAllModels, models.deleteModelOK, models.duplicateModelOK,
  models.addNewModelOK, models.updateModelOK, models.setModel, models.uploadModelOK,
  // Data recorders
  recorders.setAllDataRecorders, recorders.deleteDataRecorderOK,
  recorders.duplicateDataRecorderOK, recorders.addNewDataRecorderOK,
  recorders.updateDataRecorderOK, recorders.setDataRecorder,
  recorders.setDataRecorderStatus,
  // Data storage
  storage.setDataStorage, storage.setDataStorageConnectionStatus,
  // Logs / statistics
  logs.requestLogFileOK, logs.requestAllLogFilesOK, logs.requestDeleteLogFileOK,
  stats.requestStatsOK,
  // Any notification dismisses the spinner
  notify.setNotification,
  // Test campaigns
  campaigns.setAllTestCampaigns, campaigns.deleteTestCampaignOK,
  campaigns.addNewTestCampaignOK, campaigns.setCurrentTestCampaign,
  campaigns.updateTestCampaignOK,
  // Test cases
  testCases.setAllTestCases, testCases.setCurrentTestCase,
  testCases.deleteTestCaseOK, testCases.addNewTestCaseOK,
  testCases.updateTestCaseOK,
  // Datasets & events
  datasets.setAllDatasets, datasets.setCurrentDataset, datasets.deleteDatasetOK,
  datasets.addNewDatasetOK, datasets.updateDatasetOK, datasets.setEvents,
  datasets.deleteEventOK, datasets.addNewEventOK, datasets.updateEventOK,
  // Simulation / devops
  simulation.setSimulationStatus,
  devops.setDevops,
  // Reports
  reports.setAllReports, reports.setCurrentReport, reports.updateReportOK,
  reports.deleteReportOK, reports.setOriginalEvents, reports.setNewEvents,
];

const createRequestingReducer = (startedActions, finishedActions) =>
  createReducer(false, (builder) => {
    startedActions.forEach((action) => builder.addCase(action, () => true));
    finishedActions.forEach((action) => builder.addCase(action, () => false));
  });

export const requestingReducer = createRequestingReducer(
  REQUEST_STARTED,
  REQUEST_FINISHED
);

/**
 * The failure half of the same request lifecycle: sagas surface a failed
 * request as an error notification, so the flag is set there and cleared
 * when that request re-enters the lifecycle - either because any new
 * request starts (a retry, or any other activity superseding the stale
 * failure) or because the paired settle action for the same resource
 * arrives. Clearing on *every* settle would let an unrelated background
 * response (a status poll, say) silently swallow a visible failure, so
 * only the pairs below clear on settle. List views read this flag to swap
 * their empty state for an error state with retry instead of tracking a
 * parallel error flag per page.
 */
const FETCH_PAIRS = [
  [models.requestAllModels, [models.setAllModels]],
  [recorders.requestAllDataRecorders, [recorders.setAllDataRecorders]],
  [datasets.requestAllDatasets, [datasets.setAllDatasets]],
  [reports.requestAllReports, [reports.setAllReports]],
  [campaigns.requestAllTestCampaigns, [campaigns.setAllTestCampaigns]],
  [testCases.requestAllTestCases, [testCases.setAllTestCases]],
  [logs.requestAllLogFiles, [logs.requestAllLogFilesOK]],
];

export const requestErrorReducer = createReducer(null, (builder) => {
  // Errors ride the notification action; a non-error notification leaves
  // the recorded failure untouched.
  builder.addCase(notify.setNotification, (state, action) =>
    action.payload.type === "error" ? { message: action.payload.message } : state
  );
  // Any new request supersedes the recorded failure.
  REQUEST_STARTED.forEach((action) => builder.addCase(action, () => null));
  // A settle paired with the failed fetch replaces it with fresh data.
  FETCH_PAIRS.forEach(([, settledBy]) =>
    settledBy.forEach((action) => builder.addCase(action, () => null))
  );
});
