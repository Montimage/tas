import {
  createReducer
} from "redux-act";
import produce from "immer";
import {
  setAllReports,
  setCurrentReport,
  deleteReportOK,
  updateReportOK,
  setOriginalEvents,
  setNewEvents,
} from "../actions";

const initState = {
  allReports: [],
  currentReport: {
    report: null,
    originalEvents: [],
    newEvents: [],
  }
};

export default createReducer({
    [setAllReports]: produce((draft, reports) => {
      draft.allReports = reports;
    }),
    [deleteReportOK]: produce((draft, reportId) => {
      const newAllReports = draft.allReports.filter(rp => rp._id!== reportId);
      draft.allReports = newAllReports;
    }),
    [setCurrentReport]: produce((draft, report) => {
      draft.currentReport.report = report;
    }),
    [setOriginalEvents]: produce((draft, events) => {
      draft.currentReport.originalEvents = [...draft.currentReport.originalEvents, ...events];
    }),
    [setNewEvents]: produce((draft, events) => {
      draft.currentReport.newEvents = [...draft.currentReport.newEvents,...events];
    }),
    [updateReportOK]: produce((draft, newReport) => {
      for (let index = 0; index < draft.allReports.length; index++) {
        if (draft.allReports[index]._id === newReport._id) {
          draft.allReports.splice(index,1);
          break;
        };
      }
      draft.allReports.push(newReport);
    })
  },
  initState
);