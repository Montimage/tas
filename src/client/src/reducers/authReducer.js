import {
  createReducer
} from "redux-act";
import produce from "immer";
import {
  checkSession,
  setSession,
  login,
  setLoginError,
  logout,
  sessionExpired
} from "../actions";

// `checking` starts true: the app asks the server who it is on mount, and
// rendering the login form during that round trip would flash a sign-in
// prompt at somebody who is already signed in.
const initState = {
  authenticated: false,
  user: null,
  checking: true,
  loggingIn: false,
  error: null,
  sessionExpired: false
};

export default createReducer({
    [checkSession]: produce((draft) => {
      draft.checking = true;
    }),
    [setSession]: produce((draft, session) => {
      const authenticated = !!(session && session.authenticated);
      draft.authenticated = authenticated;
      draft.user = authenticated ? session.user : null;
      draft.checking = false;
      draft.loggingIn = false;
      draft.error = null;
      // A session that has just been established is by definition not the
      // expired one, so this is what dismisses the re-authentication modal.
      draft.sessionExpired = false;
    }),
    [login]: produce((draft) => {
      draft.loggingIn = true;
      draft.error = null;
    }),
    [setLoginError]: produce((draft, error) => {
      draft.loggingIn = false;
      draft.error = typeof error === "string" && error ? error : "Sign in failed";
    }),
    [logout]: produce((draft) => {
      draft.loggingIn = false;
      draft.error = null;
    }),
    [sessionExpired]: produce((draft) => {
      // Deliberately leaves the rest of the app mounted: the flag is what
      // raises a sign-in modal over the current page, so an unsaved form is
      // still there afterwards.
      draft.authenticated = false;
      draft.user = null;
      draft.checking = false;
      draft.sessionExpired = true;
    }),
  },
  initState
);
