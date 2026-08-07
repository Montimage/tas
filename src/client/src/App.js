import React, { Component } from "react";
import "antd/dist/antd.css";
import { Layout, Spin } from "antd";
import {
  BrowserRouter as Router,
  Switch,
  Route,
  Redirect,
} from "react-router-dom";

import ErrorBoundary from "antd/lib/alert/ErrorBoundary";
import { connect } from "react-redux";

import { checkSession } from "./actions";
import TSHeader from "./components/TSHeader";
import SessionExpiredModal from "./components/SessionExpiredModal";
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
          <Spin tip="Loading..." />
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
      <Switch>
        <Route
          exact
          path="/"
          render={() => <Redirect to="/test-campaigns" />}
        />
        <Route path="/test-campaigns/:testCampaignId">
          <TestCampaignPage />
        </Route>
        <Route path="/logs/:tool">
          <LogsPage message="This is the log file page" />
        </Route>
        <Route path="/test-campaigns">
          <TestCampaignListPage />
        </Route>
        <Route path="/test-cases/:testCaseId">
          <TestCasePage />
        </Route>
        <Route path="/test-cases">
          <TestCaseListPage />
        </Route>
        <Route path="/data-sets/:datasetId">
          <DatasetPage />
        </Route>
        <Route path="/data-sets">
          <DatasetListPage />
        </Route>
        <Route path="/data-recorders/:dataRecorderId">
          <DataRecorderPage />
        </Route>
        <Route path="/data-recorders">
          <DataRecorderListPage />
        </Route>
        <Route path="/models/:modelId">
          <ModelPage />
        </Route>
        <Route path="/models">
          <ModelListPage />
        </Route>
        <Route path="/data-storage">
          <DataStoragePage />
        </Route>
        <Route path="/simulation">
          <SimulationPage />
        </Route>
        <Route path="/reports/:reportId">
          <ReportPage />
        </Route>
        <Route path="/reports">
          <ReportListPage />
        </Route>
      </Switch>
    );
  }

  render() {
    return (
      <Router>
        <ErrorBoundary>
          <Layout className="layout" style={{ height: "100%" }}>
            <TSHeader />
            {this.renderContent()}
            <SessionExpiredModal />
          </Layout>
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
