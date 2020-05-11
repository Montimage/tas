import React from "react";
import "antd/dist/antd.css";
import { Layout } from "antd";
import { BrowserRouter as Router, Switch, Route } from "react-router-dom";

import ErrorBoundary from "antd/lib/alert/ErrorBoundary";
import TSHeader from "./components/TSHeader";
import TSFooter from "./components/TSFooter";
import ModelPage from "./pages/ModelPage";
import LogsPage from "./pages/LogsPage";
import LogFilePage from "./pages/LogFilePage";

function App() {
  return (
    <Router>
      <ErrorBoundary>
        <Layout className="layout" style={{ height: "100%" }}>
          <TSHeader />
          <Switch>
            <Route path="/data-generator/logs/:logFile">
              <LogFilePage />
            </Route>
            <Route path="/data-generator/logs">
              <LogsPage />
            </Route>
            <Route path="/data-generator">
              <ModelPage />
            </Route>
            <Route path="/logs/:logFile">
              <LogFilePage />
            </Route>
            <Route path="/logs">
              <LogsPage />
            </Route>
            <Route path="/">
              <ModelPage />
            </Route>
          </Switch>
          <TSFooter />
        </Layout>
      </ErrorBoundary>
    </Router>
  );
}

export default App;
