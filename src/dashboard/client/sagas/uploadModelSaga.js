// watcher saga -> actions -> worker saga
import { call, put, takeEvery, select } from "redux-saga/effects";

import { uploadModel } from "../api";
import { uploadModelOK, setError } from "../actions";

const getModel = ({ model }) => model;
const getTool = ({ tool }) => tool;

function* handleSaveModel() {
  try {
    let model = yield select(getModel);
    let tool = yield select(getTool);
    if (model) {
      const data = yield call(() => uploadModel(tool, model));
      yield put(uploadModelOK(data.data));
    } else {
      throw Error("Undefined model");
    }
    // dispatch data
  } catch (error) {
    // dispatch error
    yield put(setError(error.toString()));
  }
}

function* watchSaveModel() {
  yield takeEvery("UPLOAD_MODEL", handleSaveModel);
}

export default watchSaveModel;