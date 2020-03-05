import { createStore, applyMiddleware, compose } from 'redux';
import createSagaMiddleware from 'redux-saga';

import rootReducer from '../reducers';
import rootSaga from '../sagas';

const configStore = () => {
  const sagaMiddleware = createSagaMiddleware();
  const store = createStore(
    rootReducer,
    compose(
      applyMiddleware(sagaMiddleware)
      ,
      window.__REDUX_DEVTOOLS_EXTENSION__ &&
        window.__REDUX_DEVTOOLS_EXTENSION__(),
    ),
  );
  sagaMiddleware.run(rootSaga);
  // store.dispatch({ type: 'DANG' });
  // store.dispatch({ type: 'Logout' });
  // store.dispatch({ type: 'Login' });
  // store.dispatch({ type: 'Login' });
  // store.dispatch({ type: 'Login' });
  // store.dispatch({ type: 'Logout' });
  // store.dispatch({ type: 'Logout' });
  return store;
};

export default configStore;
