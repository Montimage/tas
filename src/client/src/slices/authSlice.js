import { createSlice } from '@reduxjs/toolkit';

// `checking` starts true: the app asks the server who it is on mount, and
// rendering the login form during that round trip would flash a sign-in
// prompt at somebody who is already signed in.
const authInitialState = {
  authenticated: false,
  user: null,
  checking: true,
  loggingIn: false,
  error: null,
  sessionExpired: false,
};

export const authSlice = createSlice({
  name: 'auth',
  initialState: authInitialState,
  reducers: {
    checkSession(state) {
      state.checking = true;
    },
    setSession(state, action) {
      const session = action.payload;
      const authenticated = !!(session && session.authenticated);
      state.authenticated = authenticated;
      state.user = authenticated ? session.user : null;
      state.checking = false;
      state.loggingIn = false;
      state.error = null;
      // A session that has just been established is by definition not the
      // expired one, so this is what dismisses the re-authentication modal.
      state.sessionExpired = false;
    },
    login(state) {
      state.loggingIn = true;
      state.error = null;
    },
    setLoginError(state, action) {
      const error = action.payload;
      state.loggingIn = false;
      state.error = typeof error === 'string' && error ? error : 'Sign in failed';
    },
    logout(state) {
      state.loggingIn = false;
      state.error = null;
    },
    sessionExpired(state) {
      // Deliberately leaves the rest of the app mounted: the flag is what
      // raises a sign-in modal over the current page, so an unsaved form is
      // still there afterwards.
      state.authenticated = false;
      state.user = null;
      state.checking = false;
      state.sessionExpired = true;
    },
  },
});

export const {
  checkSession,
  setSession,
  login,
  setLoginError,
  logout,
  sessionExpired,
} = authSlice.actions;
