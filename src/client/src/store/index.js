import { configureStore } from '@reduxjs/toolkit';
import createSagaMiddleware from 'redux-saga';

import rootReducer from '../reducers';
import rootSaga from '../sagas';

const configStore = () => {
  const sagaMiddleware = createSagaMiddleware();
  const store = configureStore({
    reducer: rootReducer,
    // The sagas own every async flow, so the thunk middleware is dropped;
    // the serializability/immutable checks stay off to keep the runtime
    // behaviour identical to the previous hand-wired createStore setup.
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        thunk: false,
        serializableCheck: false,
        immutableCheck: false,
      }).concat(sagaMiddleware),
    devTools: true,
  });
  sagaMiddleware.run(rootSaga);
  return store;
};

export default configStore;
