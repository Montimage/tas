import { createAction, createSlice } from '@reduxjs/toolkit';

import { addNewElementToArray, removeElementFromArray } from '../utils';

// Request triggers: watched by the test-case sagas and tracked by the
// global `requesting` flag, but no reducer of this domain consumes them.
export const requestAllTestCases = createAction('REQUEST_ALL_TEST_CASES');
export const requestDeleteTestCase = createAction('REQUEST_DELETE_TEST_CASE');
export const requestAddNewTestCase = createAction('REQUEST_ADD_NEW_TEST_CASE');
export const requestTestCase = createAction('REQUEST_TEST_CASE');
export const requestUpdateTestCase = createAction('REQUEST_UPDATE_TEST_CASE');
// Settle-only action: tracked by the global `requesting` flag and dispatched
// by the test-case saga; no reducer of this domain consumes it.
export const updateTestCaseOK = createAction('UPDATE_TEST_CASE_OK');

const testCasesInitialState = {
  allTestCases: [],
  currentTestCase: 0,
};

export const testCasesSlice = createSlice({
  name: 'testCases',
  initialState: testCasesInitialState,
  reducers: {
    setAllTestCases(state, action) {
      state.allTestCases = action.payload;
    },
    addNewTestCaseOK(state, action) {
      if (state.allTestCases) {
        const newAllTestCases = addNewElementToArray(
          state.allTestCases,
          action.payload
        );
        state.allTestCases = [...newAllTestCases];
      } else {
        state.allTestCases = [action.payload];
      }
    },
    deleteTestCaseOK(state, action) {
      const newAllTestCases = removeElementFromArray(
        state.allTestCases,
        action.payload
      );
      if (newAllTestCases) state.allTestCases = [...newAllTestCases];
    },
    setCurrentTestCase(state, action) {
      state.currentTestCase = action.payload;
    },
  },
});

export const {
  setAllTestCases,
  setCurrentTestCase,
  deleteTestCaseOK,
  addNewTestCaseOK,
} = testCasesSlice.actions;
