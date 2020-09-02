import React from "react";
import "antd/dist/antd.css";
import { Layout } from "antd";
import { BrowserRouter as Router, Switch, Route, Redirect } from "react-router-dom";

import ErrorBoundary from "antd/lib/alert/ErrorBoundary";
import TSHeader from "./components/TSHeader";
import ModelPage from "./pages/ModelPage";
import DummyPage from './pages/DummyPage';
import DataStoragePage from './pages/DataStoragePage';
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

function App() {
  return (
    <Router>
      <ErrorBoundary>
        <Layout className="layout" style={{ height: "100%" }}>
          <TSHeader />
          <Switch>
            <Route exact path="/" render={() => <Redirect to="/test-campaigns"/>} />
            <Route path="/test-campaigns/:testCampaignId">
              <TestCampaignPage />
            </Route>
            <Route path="/logs/:tool">
              <LogsPage message="This is the log file page"/>
            </Route>
            <Route path="/test-campaigns">
              <TestCampaignListPage />
            </Route>
            <Route path="/test-cases/:testCaseId">
              <TestCasePage/>
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
            <Route path="/logs/test-campaigns">
              <DummyPage message="This is the log file list page of test campaigns"/>
            </Route>
            <Route path="/reports/test-campaigns/:fileName">
              <DummyPage message="This is the reports file page"/>
            </Route>
            <Route path="/reports/test-campaigns">
              <DummyPage message="This is the reports file list page of test campaigns"/>
            </Route>
            <Route path="/devopts/">
              <DummyPage message="This is the devopts page"/>
            </Route>
          </Switch>          
        </Layout>
      </ErrorBoundary>
    </Router>
  );
}

export default App;
