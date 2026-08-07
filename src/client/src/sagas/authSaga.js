// watcher saga -> actions -> worker saga
import {
  call,
  fork,
  put,
  take,
  takeEvery,
} from 'redux-saga/effects';
import { eventChannel } from 'redux-saga';

import {
  requestLogin,
  requestLogout,
  requestSession,
  onSessionExpired,
} from '../api';
import {
  setNotification,
  setSession,
  setLoginError,
  sessionExpired,
} from '../actions';

function* handleCheckSession() {
  try {
    const session = yield call(() => requestSession());
    yield put(setSession(session));
  } catch (error) {
    // Asking who we are must never leave the app stuck on its loading state:
    // an unreachable server is answered the same way as an anonymous one.
    yield put(setSession({ authenticated: false }));
    yield put(setNotification({type: 'error', message: error}));
  }
}

function* handleLogin(action) {
  try {
    const session = yield call(() => requestLogin(action.payload));
    yield put(setSession(session));
  } catch (error) {
    // The api layer throws a plain string, which is what the login form shows.
    yield put(setLoginError(error));
  }
}

function* handleLogout() {
  try {
    yield call(() => requestLogout());
  } catch (error) {
    yield put(setNotification({type: 'error', message: error}));
  }
  // Whether or not the server could be told, this browser is signed out.
  yield put(setSession({ authenticated: false }));
}

/**
 * Turn the api layer's session-expiry callback into a saga channel.
 *
 * The api layer cannot dispatch - it knows nothing about the store - so it
 * exposes one subscriber slot instead, and this is the bridge to it.
 */
function createSessionExpiryChannel() {
  return eventChannel((emitter) => {
    onSessionExpired(() => emitter(true));
    return () => onSessionExpired(null);
  });
}

function* watchSessionExpiry() {
  const channel = yield call(createSessionExpiryChannel);
  while (true) {
    yield take(channel);
    yield put(sessionExpired());
  }
}

function* watchAuth() {
  yield fork(watchSessionExpiry);
  yield takeEvery('CHECK_SESSION', handleCheckSession);
  yield takeEvery('LOGIN', handleLogin);
  yield takeEvery('LOGOUT', handleLogout);
}

export default watchAuth;
