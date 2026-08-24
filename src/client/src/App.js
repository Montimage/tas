import React, { Component, useEffect } from "react";
import { ConfigProvider, Layout, Spin } from "antd";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";

import ErrorBoundary from "./components/ErrorBoundary";
import { connect } from "react-redux";

import { checkSession } from "./actions";

/**
 * Moves keyboard focus to the main content region after every client-side
 * navigation (issue #39), so keyboard and screen-reader users land where the
 * page content starts instead of staying on the last control they activated.
 */
const FocusOnNavigation = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    const main = document.getElementById("main-content");
    if (main) main.focus();
  }, [pathname]);
  return null;
};

import TSHeader from "./components/TSHeader";
import SessionExpiredModal from "./components/SessionExpiredModal";
import GraphView from "./components/GraphView";
import LoginPage from "./pages/LoginPage";
import ModelPage from "./pages/ModelPage";
import DataStoragePage from "./pages/DataStoragePage";
import TestCampaignListPage from "./pages/TestCampaignListPage";
import ModelListPage from "./pages/ModelListPage";
import DataRecorderListPage from "./pages/DataRecorderListPage";
import DataRecorderPage from "./pages/DataRecorderPage";
import TestCampaignPage from "./pages/TestCampaignPage";
import TestCaseListPage from "./pages/TestCaseListPage";
import TestCasePage from "./pages/TestCasePage";
import DatasetListPage from "./pages/DatasetListPage";
import DatasetPage from "./pages/DatasetPage";
import SimulationPage from "./pages/SimulationPage";
import LogsPage from "./pages/LogsPage";
import ReportListPage from "./pages/ReportListPage";
import ReportPage from "./pages/ReportPage";

/**
 * The routed dashboard, or a sign-in prompt when there is no session.
 *
 * Three states, and the third is the one that matters. While the session is
 * being resolved the app shows nothing but a spinner, because rendering either
 * of the other two would be a guess. With no session at all it shows the login
 * page. But when a session expires *underneath* a page that is already open,
 * the routed content stays exactly where it is and a modal is laid over it
 * (see `SessionExpiredModal`) - navigating away would silently discard whatever
 * the operator had typed and not yet saved.
 */
class App extends Component {
  componentDidMount() {
    this.props.checkSession();
  }

  renderContent() {
    const { checking, authenticated, sessionExpired } = this.props;
    if (checking) {
      return (
        <div style={{ textAlign: "center", marginTop: 60 }}>
          {/* antd v5+ logs a console warning for `tip` on an unnested Spin,
              so the label is rendered next to the spinner instead. */}
          <Spin />
          <div style={{ marginTop: 12 }}>Loading...</div>
        </div>
      );
    }
    if (!authenticated && !sessionExpired) {
      return <LoginPage />;
    }
    return this.renderRoutes();
  }

  renderRoutes() {
    return (
      <Routes>
        <Route
          path="/"
          element={<Navigate to="/test-campaigns" replace />}
        />
        <Route
          path="/test-campaigns/:testCampaignId"
          element={<TestCampaignPage />}
        />
        <Route path="/logs/:tool" element={<LogsPage message="This is the log file page" />} />
        <Route path="/test-campaigns" element={<TestCampaignListPage />} />
        <Route path="/test-cases/:testCaseId" element={<TestCasePage />} />
        <Route path="/test-cases" element={<TestCaseListPage />} />
        <Route path="/data-sets/:datasetId" element={<DatasetPage />} />
        <Route path="/data-sets" element={<DatasetListPage />} />
        <Route
          path="/data-recorders/:dataRecorderId"
          element={<DataRecorderPage />}
        />
        <Route path="/data-recorders" element={<DataRecorderListPage />} />
        <Route path="/models/:modelId" element={<ModelPage />} />
        <Route path="/models" element={<ModelListPage />} />
        <Route path="/data-storage" element={<DataStoragePage />} />
        <Route path="/simulation" element={<SimulationPage />} />
        <Route path="/graphview" element={<GraphView />} />
        <Route path="/reports/:reportId" element={<ReportPage />} />
        <Route path="/reports" element={<ReportListPage />} />
      </Routes>
    );
  }

  render() {
    return (
      <Router>
        <ErrorBoundary>
          <ConfigProvider
            /* Issue #44: the axe gate flagged antd's default primary blue and
               secondary grey as failing 4.5:1 contrast on white. The theme
               tokens darken both globally instead of scattering overrides. */
            theme={{
              token: {
                colorPrimary: "#0b57d0",
                colorLink: "#0b57d0",
                colorTextSecondary: "#595959",
                colorTextDescription: "#595959",
                colorError: "#b42318",
              },
            }}
          >
            <Layout className="layout" style={{ height: "100%" }}>
              {/* First focusable element on every page (issue #39): lets
                  keyboard users bypass the repeated navigation. */}
              <a className="skip-link" href="#main-content">
                Skip to main content
              </a>
              <FocusOnNavigation />
              <TSHeader />
              <div id="main-content" tabIndex={-1}>
                {this.renderContent()}
              </div>
              <SessionExpiredModal />
            </Layout>
          </ConfigProvider>
        </ErrorBoundary>
      </Router>
    );
  }
}

const mapPropsToStates = ({ auth }) => ({
  authenticated: auth.authenticated,
  checking: auth.checking,
  sessionExpired: auth.sessionExpired,
});

const mapDispatchToProps = (dispatch) => ({
  checkSession: () => dispatch(checkSession()),
});

export default connect(mapPropsToStates, mapDispatchToProps)(App);
