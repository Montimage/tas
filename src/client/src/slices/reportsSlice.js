import { createAction, createSlice } from '@reduxjs/toolkit';

// Request triggers: watched by the reports saga and tracked by the global
// `requesting` flag, but no reducer of this domain consumes them.
export const requestAllReports = createAction('REQUEST_ALL_REPORTS');
export const requestReport = createAction('REQUEST_REPORT');
export const requestUpdateReport = createAction('REQUEST_UPDATE_REPORT');
export const requestDeleteReport = createAction('REQUEST_DELETE_REPORT');
export const requestOriginalEvents = createAction('REQUEST_ORIGINAL_EVENTS');
export const requestNewEvents = createAction('REQUEST_NEW_EVENTS');

const reportsInitialState = {
  allReports: [],
  currentReport: {
    report: null,
    originalEvents: [],
    newEvents: [],
  },
};

export const reportsSlice = createSlice({
  name: 'reports',
  initialState: reportsInitialState,
  reducers: {
    setAllReports(state, action) {
      state.allReports = action.payload;
    },
    deleteReportOK(state, action) {
      const newAllReports = state.allReports.filter(
        (rp) => rp._id !== action.payload
      );
      state.allReports = newAllReports;
    },
    setCurrentReport(state, action) {
      state.currentReport.report = action.payload;
    },
    setOriginalEvents(state, action) {
      state.currentReport.originalEvents = [
        ...state.currentReport.originalEvents,
        ...action.payload,
      ];
    },
    setNewEvents(state, action) {
      state.currentReport.newEvents = [
        ...state.currentReport.newEvents,
        ...action.payload,
      ];
    },
    updateReportOK(state, action) {
      const newReport = action.payload;
      for (let index = 0; index < state.allReports.length; index++) {
        if (state.allReports[index]._id === newReport._id) {
          state.allReports.splice(index, 1);
          break;
        }
      }
      state.allReports.push(newReport);
    },
  },
});

export const {
  setAllReports,
  setCurrentReport,
  deleteReportOK,
  updateReportOK,
  setOriginalEvents,
  setNewEvents,
} = reportsSlice.actions;
