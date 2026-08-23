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
  // Server-side paging state for the report list (issue #85).
  total: 0,
  limit: 50,
  skip: 0,
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
    setReportsPaging(state, action) {
      const { total, limit, skip } = action.payload;
      if (total !== undefined) state.total = total;
      if (limit !== undefined) state.limit = limit;
      if (skip !== undefined) state.skip = skip;
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
  setReportsPaging,
  setCurrentReport,
  deleteReportOK,
  updateReportOK,
  setOriginalEvents,
  setNewEvents,
} = reportsSlice.actions;
