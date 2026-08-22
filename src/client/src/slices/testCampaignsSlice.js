import { createAction, createSlice } from '@reduxjs/toolkit';

import { addNewElementToArray, removeElementFromArray } from '../utils';

// Request triggers: watched by the test-campaign sagas and tracked by the
// global `requesting` flag, but no reducer of this domain consumes them.
export const requestAllTestCampaigns = createAction('REQUEST_ALL_TEST_CAMPAIGNS');
export const requestDeleteTestCampaign = createAction('REQUEST_DELETE_TEST_CAMPAIGN');
export const requestAddNewTestCampaign = createAction('REQUEST_ADD_NEW_TEST_CAMPAIGN');
export const requestTestCampaign = createAction('REQUEST_TEST_CAMPAIGN');
export const requestUpdateTestCampaign = createAction('REQUEST_UPDATE_TEST_CAMPAIGN');
// Settle-only action: tracked by the global `requesting` flag and dispatched
// by the test-campaign saga; no reducer of this domain consumes it.
export const updateTestCampaignOK = createAction('UPDATE_TEST_CAMPAIGN_OK');
export const requestLaunchTestCampaign = createAction('REQUEST_LAUNCH_TEST_CAMPAIGN');
export const requestStopTestCampaign = createAction('REQUEST_STOP_TEST_CAMPAIGN');
export const requestTestCampaignStatus = createAction('REQUEST_TEST_CAMPAIGN_STATUS');

const testCampaignsInitialState = {
  allTestCampaigns: [],
  currentTestCampaign: 0,
  runningStatus: null,
};

export const testCampaignsSlice = createSlice({
  name: 'testCampaigns',
  initialState: testCampaignsInitialState,
  reducers: {
    setAllTestCampaigns(state, action) {
      state.allTestCampaigns = action.payload;
    },
    addNewTestCampaignOK(state, action) {
      if (state.allTestCampaigns) {
        const newAllTestCampaigns = addNewElementToArray(
          state.allTestCampaigns,
          action.payload
        );
        state.allTestCampaigns = [...newAllTestCampaigns];
      } else {
        state.allTestCampaigns = [action.payload];
      }
    },
    deleteTestCampaignOK(state, action) {
      const newAllTestCampaigns = removeElementFromArray(
        state.allTestCampaigns,
        action.payload
      );
      if (newAllTestCampaigns) state.allTestCampaigns = [...newAllTestCampaigns];
    },
    setCurrentTestCampaign(state, action) {
      state.currentTestCampaign = action.payload;
    },
    setTestCampaignRunningStatus(state, action) {
      state.runningStatus = action.payload;
    },
  },
});

export const {
  setAllTestCampaigns,
  setCurrentTestCampaign,
  deleteTestCampaignOK,
  addNewTestCampaignOK,
  setTestCampaignRunningStatus,
} = testCampaignsSlice.actions;
