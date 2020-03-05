import {
  all
} from 'redux-saga/effects';

import loadModelSaga from './loadModelSaga';
import saveModelSaga from './saveModelSaga';
import deploySaga from './deploySaga';
import logsSaga from './logsSaga';

function* rootSaga() {
  yield all([loadModelSaga(),saveModelSaga(), deploySaga(), logsSaga()]);
}

export default rootSaga;
