import {
  createReducer
} from "redux-act";
import produce from "immer";
import {
  setAllTestCampaigns,
  setCurrentTestCampaign,
  deleteTestCampaignOK,
  addNewTestCampaignOK,
  setTestCampaignRunningStatus
} from "../actions";

import { addNewElementToArray, removeElementFromArray } from "../utils";

const initState = {
  allTestCampaigns: [],
  currentTestCampaign: 0,
  runningStatus: null
};

export default createReducer({
    [setAllTestCampaigns]: produce((draft, testCampaigns) => {
      draft.allTestCampaigns = testCampaigns;
    }),
    [addNewTestCampaignOK]: produce((draft, newTC) => {
      if (draft.allTestCampaigns) {
        const newAllTestCampaigns = addNewElementToArray(draft.allTestCampaigns, newTC);
        draft.allTestCampaigns = [...newAllTestCampaigns];
      } else {
        draft.allTestCampaigns = [newTC];
      }
    }),
    [deleteTestCampaignOK]: produce((draft, testCampaignId) => {
      const newAllTestCampaigns = removeElementFromArray(draft.allTestCampaigns, testCampaignId);
      if (newAllTestCampaigns) draft.allTestCampaigns = [...newAllTestCampaigns];
    }),
    [setCurrentTestCampaign]: produce((draft, testCampaign) => {
      draft.currentTestCampaign = testCampaign;
    }),
    [setTestCampaignRunningStatus]: produce((draft, runningStatus) => {
      draft.runningStatus = runningStatus;
    }),
  },
  initState
);