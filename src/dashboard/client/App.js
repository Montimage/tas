import React, { Component } from "react";
import "antd/dist/antd.css";
import { Layout } from "antd";
import ErrorBoundary from "antd/lib/alert/ErrorBoundary";
import TSHeader from "./components/TSHeader";
import LeftSider from "./components/LeftSider";
import RightSider from "./components/RightSider";
import MainView from "./components/MainView";
import TSFooter from "./components/TSFooter";
const { Content } = Layout;

class App extends Component {
  render() {
    return (
      <ErrorBoundary>
        <Layout className="layout" style={{height: '100%'}}>
          <TSHeader />
          <Layout>
            <LeftSider />
            <Layout style={{ padding: "0 24px 24px" }}>
              <Content>
                <MainView />
              </Content>
            </Layout>
            <RightSider />
          </Layout>
          <TSFooter />
        </Layout>
      </ErrorBoundary>
    );
  }
}

export default App;
