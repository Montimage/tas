import {
  combineReducers
} from 'redux';

import loadingReducer from './loadingReducer';
import modelReducer from './modelReducer';
import deployReducer from './deployReducer';
import logsReducer from './logsReducer';
import viewReducer from './viewReducer';
import contentTypeReducer from './contentTypeReducer';

const rootReducer = combineReducers({
  loadModel: loadingReducer,
  saveModel: modelReducer,
  deployment: deployReducer,
  logs: logsReducer,
  view: viewReducer,
  contentType: contentTypeReducer
});

export default rootReducer;
