// watcher saga -> actions -> worker saga
import {
  call,
  put,
  takeEvery,
  select
} from 'redux-saga/effects';

import {
  MODELS
} from '../constants';
import {
  saveModel
} from '../api';
import {
  saveModelOK,
  saveModelError
} from '../actions';

const getModel = ({loadModel}) => loadModel.model;

function* handleSaveModel() {
  try {
    let model = yield select(getModel);
    console.log('model: ', model);
    if (model) {
      const data = yield call(() => saveModel(model));
      console.log('response: ', data.data);
      yield put(saveModelOK(data.data));
    } else {
      throw Error('Undefined model');
    }
    // dispatch data
  } catch (error) {
    // dispatch error
    yield put(saveModelError(error.toString()));
  }
}

function* watchSaveModel() {
  yield takeEvery(MODELS.SAVE, handleSaveModel);
}

export default watchSaveModel;
