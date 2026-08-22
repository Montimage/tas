import { combineReducers } from 'redux';

import { allModelsSlice, modelSlice } from '../slices/modelSlices';
import {
  allDataRecordersSlice,
  dataRecorderSlice,
  dataRecorderStatusSlice,
} from '../slices/dataRecorderSlices';
import { dataStorageSlice } from '../slices/dataStorageSlice';
import { logsSlice } from '../slices/logsSlice';
import { statsSlice } from '../slices/statsSlice';
import { simulationStatusSlice } from '../slices/simulationSlice';
import { testCampaignsSlice } from '../slices/testCampaignsSlice';
import { devopsSlice } from '../slices/devopsSlice';
import { testCasesSlice } from '../slices/testCasesSlice';
import { datasetsSlice } from '../slices/datasetsSlice';
import { reportsSlice } from '../slices/reportsSlice';
import { authSlice } from '../slices/authSlice';
import { editingFormSlice } from '../slices/editingFormSlice';
import { notificationSlice } from '../slices/notificationSlice';
import { requestingReducer } from '../slices/requestingSlice';

// State keys are the store's public shape - every component selects through
// them, so they must not change even though the reducers are now slices.
const rootReducer = combineReducers({
  allDataRecorders: allDataRecordersSlice.reducer,
  dataRecorder: dataRecorderSlice.reducer,
  dataRecorderStatus: dataRecorderStatusSlice.reducer,
  dataStorage: dataStorageSlice.reducer,
  allModels: allModelsSlice.reducer,
  model: modelSlice.reducer,
  stats: statsSlice.reducer,
  logs: logsSlice.reducer,
  notify: notificationSlice.reducer,
  requesting: requestingReducer,
  editingForm: editingFormSlice.reducer,
  simulationStatus: simulationStatusSlice.reducer,
  testCampaigns: testCampaignsSlice.reducer,
  devops: devopsSlice.reducer,
  testCases: testCasesSlice.reducer,
  datasets: datasetsSlice.reducer,
  reports: reportsSlice.reducer,
  auth: authSlice.reducer,
});

export default rootReducer;
