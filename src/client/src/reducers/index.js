import {
  combineReducers
} from 'redux';

import modelReducer from './modelReducer';
import requestingReducer from './requestingReducer';
import notificationReducer from './notificationReducer';
import logsReducer from './logsReducer';
import editingFormReducer from './editingFormReducer';
import deployStatusReducer from './deployStatusReducer';
import statsReducer from './statsReducer';

const rootReducer = combineReducers({
  model: modelReducer,
  stats: statsReducer,
  logs: logsReducer,
  notify: notificationReducer,
  requesting: requestingReducer,
  editingForm: editingFormReducer,
  deployStatus: deployStatusReducer,
});

export default rootReducer;
