import {
  combineReducers
} from 'redux';

import modelReducer from './modelReducer';
import requestingReducer from './requestingReducer';
import notificationReducer from './notificationReducer';
import logsReducer from './logsReducer';
import editingFormReducer from './editingFormReducer';
import simulationStatusReducer from './simulationStatusReducer';
import statsReducer from './statsReducer';
import allModelsReducer from './allModelsReducer';
import allDataRecordersReducer from './allDataRecordersReducer';
import dataRecorderReducer from './dataRecorderReducer';
import dataRecorderStatusReducer from './dataRecorderStatusReducer';
import dataStorageReducer from './dataStorageReducer';
import testCampaignsReducer from './testCampaignsReducer';
import devoptsReducer from './devoptsReducer';
import testCasesReducer from './testCasesReducer';
import datasetsReducer from './datasetsReducer';

const rootReducer = combineReducers({
  allDataRecorders: allDataRecordersReducer,
  dataRecorder: dataRecorderReducer,
  dataRecorderStatus: dataRecorderStatusReducer,
  dataStorage: dataStorageReducer,
  allModels: allModelsReducer,
  model: modelReducer,
  stats: statsReducer,
  logs: logsReducer,
  notify: notificationReducer,
  requesting: requestingReducer,
  editingForm: editingFormReducer,
  simulationStatus: simulationStatusReducer,
  testCampaigns: testCampaignsReducer,
  devopts: devoptsReducer,
  testCases: testCasesReducer,
  datasets: datasetsReducer,
});

export default rootReducer;
