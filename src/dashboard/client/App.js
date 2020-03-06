import React, { Component } from "react";
import { Provider } from "react-redux";
import "antd/dist/antd.css";

import { Layout } from "antd";
const { Content, Footer } = Layout;

import TSHeader from "./components/TSHeader";
import LeftSider from "./components/LeftSider";
import RightSider from "./components/RightSider";
import MainView from "./components/MainView";
// all the edit forms
import ThingModal from './components/ThingModal';
import SensorModal from './components/SensorModal';

import configStore from "./store";

const store = configStore();

class App extends Component {
  render() {
    return (
      <Provider store={store}>
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
            <ThingModal />
            <SensorModal />
          </Layout>
          <Footer style={{ textAlign: "center"}}>
            ENACT ©2020 Created by Montimage
          </Footer>
        </Layout>
      </Provider>
    );
  }
}

export default App;
