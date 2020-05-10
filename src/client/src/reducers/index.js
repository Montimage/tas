import {
  combineReducers
} from 'redux';

import modelReducer from './modelReducer';
import requestingReducer from './requestingReducer';
import notificationReducer from './notificationReducer';
import logsReducer from './logsReducer';
import editingFormReducer from './editingFormReducer';
import deployStatusReducer from './deployStatusReducer';

const rootReducer = combineReducers({
  model: modelReducer,
  logs: logsReducer,
  notify: notificationReducer,
  requesting: requestingReducer,
  editingForm: editingFormReducer,
  deployStatus: deployStatusReducer,
});

export default rootReducer;
