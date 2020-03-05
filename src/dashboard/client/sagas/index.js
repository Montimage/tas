import {
  all
} from 'redux-saga/effects';

import requestModelSaga from './requestModelSaga';
import uploadModelSaga from './uploadModelSaga';
import deploySaga from './deploySaga';
import requestLogsSaga from './requestLogsSaga';

function* rootSaga() {
  yield all([requestModelSaga(),uploadModelSaga(), deploySaga(), requestLogsSaga()]);
}

export default rootSaga;
