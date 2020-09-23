import React, { Component } from "react";
import { connect } from "react-redux";
import { Layout, Menu, Row, Col } from "antd";
import {
  ClusterOutlined, DatabaseOutlined, DeploymentUnitOutlined, InteractionOutlined, FileTextOutlined, FolderOpenOutlined, EyeOutlined,
} from "@ant-design/icons";

import {
  setNotification,
} from "../../actions";
import "./styles.css";

const { Header } = Layout;

class TSHeader extends Component {
  render() {
    const menuLinks = [
      '/test-campaigns',
      '/test-cases',
      '/models',
      '/simulation',
      '/data-recorders',
      '/data-sets',
      '/data-storage',
      '/reports'
    ];
    // Calculate the selected menu
    let selectedMenu = 0;
    const fullPath = window.location.pathname;
    let currentPositionIndex = fullPath.length - 1;
    for (let index = 0; index < menuLinks.length; index++) {
      const positionIndex = fullPath.indexOf(menuLinks[index]);
      if ( positionIndex > -1 && positionIndex < currentPositionIndex) {
        currentPositionIndex = positionIndex;
        selectedMenu = index;
      }
    }

    return (
      <Header>
        <Row>
          <Col span={4}>
            <a href="/">
              <img
                src={'/img/Logo.png'}
                className="logo"
                alt="Logo"
                style={{ maxWidth: "250px", objectFit: "contain" }}
              />
            </a>
          </Col>
          <Col span={14} push={6}>
            <Menu theme="light" mode="horizontal" style={{ lineHeight: "64px" }} selectedKeys={`${selectedMenu}`}>
              <Menu.Item key="0">
                <a href={menuLinks[0]}>
                  <InteractionOutlined />
                  Test Campaign
                </a>
              </Menu.Item>
              <Menu.Item key="1">
                <a href={menuLinks[1]}>
                  <FolderOpenOutlined />
                  Test Case
                </a>
              </Menu.Item>
              <Menu.Item key="2">
                <a href={menuLinks[2]}>
                  <ClusterOutlined />
                  Topology
                </a>
              </Menu.Item>
              <Menu.Item key="3">
                <a href={menuLinks[3]}>
                  <DeploymentUnitOutlined />
                  Simulation
                </a>
              </Menu.Item>
              <Menu.Item key="4">
                <a href={menuLinks[4]}>
                  <EyeOutlined />
                  Data Recorder
                </a>
              </Menu.Item>
              <Menu.Item key="5">
                <a href={menuLinks[5]}>
                  <FileTextOutlined />
                  Data Set
                </a>
              </Menu.Item>
              <Menu.Item key="6">
                <a href={menuLinks[6]}>
                  <DatabaseOutlined />
                  Data Storage
                </a>
              </Menu.Item>
              <Menu.Item key="7">
                <a href={menuLinks[7]}>
                  <FileTextOutlined />
                  Report
                </a>
              </Menu.Item>
            </Menu>
          </Col>
        </Row>

      </Header>
    );
  }
}

const mapPropsToStates = ({ requesting }) => ({
  requesting,
});

const mapDispatchToProps = (dispatch) => ({
  setNotification: ({ type, message }) =>
    dispatch(setNotification({ type, message })),
});

export default connect(mapPropsToStates, mapDispatchToProps)(TSHeader);
