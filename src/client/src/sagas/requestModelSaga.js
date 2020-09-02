// watcher saga -> actions -> worker saga
import {
  call,
  put,
  takeEvery,
} from 'redux-saga/effects';

import {
  requestModel,
  requestAllModels,
  requestDeleteModel,
  requestDuplicateModel,
  uploadModel,
  updateModel
} from '../api';
import {
  setModel,
  setNotification,
  setAllModels,  
  deleteModelOK,  
  duplicateModelOK,  
  addNewModelOK,
  updateModelOK
} from '../actions';

function* handleRequestModel(action) {
  try {
    const modelFileName = action.payload;
    const model = yield call(() => requestModel(modelFileName));
    yield put(setModel(model));
    // dispatch data
  } catch (error) {
    // dispatch error
    yield put(setNotification({type: 'error', message: error}));
  }
}

function* handleRequestDeleteModel(action) {  
  try {
    const modelFileName = action.payload;
    yield call(() => requestDeleteModel(modelFileName));
    yield put(deleteModelOK(modelFileName));
    yield put(setNotification({type: 'success', message: `Model ${modelFileName} has been deleted!`}));
    // dispatch data
  } catch (error) {
    // dispatch error
    yield put(setNotification({type: 'error', message: error}));
  }
}

function* handleRequestDuplicateModel(action) {  
  try {
    const modelFileName = action.payload;
    const duplicatedModel = yield call(() => requestDuplicateModel(modelFileName));
    yield put(duplicateModelOK(duplicatedModel));
    yield put(setNotification({type: 'success', message: `Model ${duplicatedModel} has been created!`}));
    // dispatch data
  } catch (error) {
    // dispatch error
    yield put(setNotification({type: 'error', message: error}));
  }
}

function* handleRequestAddNewModel(action) {  
  try {
    const model = action.payload;
    const modelFileName = yield call(() => uploadModel(model));
    yield put(addNewModelOK(modelFileName));
    yield put(setNotification({type: 'success', message: `Model ${modelFileName} has been created!`}));
    // dispatch data
  } catch (error) {
    // dispatch error
    yield put(setNotification({type: 'error', message: error}));
  }
}

function* handleRequestUpdateModel(action) {  
  try {
    const {modelFileName, model} = action.payload;
    yield call(() => updateModel(modelFileName, model));
    yield put(updateModelOK(modelFileName));
    yield put(setNotification({type: 'success', message: `Model ${modelFileName} has been updated!`}));
    // dispatch data
  } catch (error) {
    // dispatch error
    yield put(setNotification({type: 'error', message: error}));
  }
}

function* handleRequestAllModels() {
  try {
    const models = yield call(() => requestAllModels());
    yield put(setAllModels(models));
    // dispatch data
  } catch (error) {
    // dispatch error
    yield put(setNotification({type: 'error', message: error}));
  }
}

function* watchRequestModel() {
  yield takeEvery('REQUEST_MODEL', handleRequestModel);
  yield takeEvery('REQUEST_ALL_MODELS', handleRequestAllModels);
  yield takeEvery('REQUEST_DELETE_MODEL', handleRequestDeleteModel);
  yield takeEvery('REQUEST_DUPLICATE_MODEL', handleRequestDuplicateModel);
  yield takeEvery('REQUEST_ADD_NEW_MODEL', handleRequestAddNewModel);
  yield takeEvery('REQUEST_UPDATE_MODEL', handleRequestUpdateModel);
}

export default watchRequestModel;
