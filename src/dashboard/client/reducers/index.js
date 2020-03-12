import {
  combineReducers
} from 'redux';

import modelReducer from './modelReducer';
import requestingReducer from './requestingReducer';
import notificationReducer from './notificationReducer';
import logsReducer from './logsReducer';
import viewReducer from './viewReducer';
import toolReducer from './toolReducer';
import editingFormReducer from './editingFormReducer';

const rootReducer = combineReducers({
  model: modelReducer,
  logs: logsReducer,
  view: viewReducer,
  notify: notificationReducer,
  requesting: requestingReducer,
  tool: toolReducer,
  editingForm: editingFormReducer
});

export default rootReducer;
