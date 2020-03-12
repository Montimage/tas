// watcher saga -> actions -> worker saga
import { call, put, takeEvery, select } from "redux-saga/effects";

import { uploadModel } from "../api";
import { uploadModelOK, setNotification } from "../actions";

const getModel = ({ model }) => model;
const getTool = ({ tool }) => tool;

function* handleSaveModel() {
  try {
    let model = yield select(getModel);
    let tool = yield select(getTool);
    if (model) {
      const data = yield call(() => uploadModel(tool, model));
      yield put(uploadModelOK(data.data));
      yield put(setNotification({type: 'success', message: `Model ${model.name} has been updated!`}));
    } else {
      throw Error("Undefined model");
    }
    // dispatch data
  } catch (error) {
    // dispatch error
    yield put(setNotification({type: 'error', message: error}));
  }
}

function* watchSaveModel() {
  yield takeEvery("UPLOAD_MODEL", handleSaveModel);
}

export default watchSaveModel;
