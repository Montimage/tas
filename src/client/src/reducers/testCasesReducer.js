import {
  createReducer
} from "redux-act";
import produce from "immer";
import {
  setAllTestCases,
  setCurrentTestCase,
  deleteTestCaseOK,
  addNewTestCaseOK
} from "../actions";

import { addNewElementToArray, removeElementFromArray } from "../utils";

const initState = {
  allTestCases: [],
  currentTestCase: 0
};

export default createReducer({
    [setAllTestCases]: produce((draft, testCases) => {
      draft.allTestCases = testCases;
    }),
    [addNewTestCaseOK]: produce((draft, newTC) => {
      if (draft.allTestCases) {
        const newAllTestCases = addNewElementToArray(draft.allTestCases, newTC);
        draft.allTestCases = [...newAllTestCases];
      } else {
        draft.allTestCases = [newTC];
      }
    }),
    [deleteTestCaseOK]: produce((draft, testCaseId) => {
      const newAllTestCases = removeElementFromArray(draft.allTestCases, testCaseId);
      if (newAllTestCases) draft.allTestCases = [...newAllTestCases];
    }),
    [setCurrentTestCase]: produce((draft, testCase) => {
      draft.currentTestCase = testCase;
    }),
  },
  initState
);