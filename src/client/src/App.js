import React from "react";
import "antd/dist/antd.css";
import { Layout } from "antd";
import { BrowserRouter as Router, Switch, Route } from "react-router-dom";

import ErrorBoundary from "antd/lib/alert/ErrorBoundary";
import TSHeader from "./components/TSHeader";
import TSFooter from "./components/TSFooter";
import LeftSider from "../../client/src/components/LeftSider";
import RightSider from "../../client/src/components/RightSider";
import ModelPage from "./pages/ModelPage";
import LogsPage from "./pages/LogsPage";
import LogFilePage from "./pages/LogFilePage";
const { Content } = Layout;

const MainView = () => (
  <Layout>
    <LeftSider />
    <Layout style={{ padding: "0 24px 24px" }}>
      <Content>
        <ModelPage />
      </Content>
    </Layout>
    <RightSider />
  </Layout>
);

const LogView = ({ children }) => (
  <Layout>
    <Layout style={{ padding: "0 48px 48px" }}>
      <Content>{children}</Content>
    </Layout>
  </Layout>
);

function App() {
  return (
    <Router>
      <ErrorBoundary>
        <Layout className="layout" style={{ height: "100%" }}>
          <TSHeader />
          <Switch>
            <Route path="/data-generator/logs/:logFile">
              <LogView>
                <LogFilePage />
              </LogView>
            </Route>
            <Route path="/data-generator/logs">
              <LogView>
                <LogsPage />
              </LogView>
            </Route>
            <Route path="/data-generator">
              <MainView />
            </Route>
            <Route path="/logs/:logFile">
              <LogView>
                <LogFilePage />
              </LogView>
            </Route>
            <Route path="/logs">
              <LogView>
                <LogsPage />
              </LogView>
            </Route>
            <Route path="/">
              <MainView />
            </Route>
          </Switch>
          <TSFooter />
        </Layout>
      </ErrorBoundary>
    </Router>
  );
}

export default App;
