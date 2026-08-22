import React, { Component } from "react";
import { connect } from "react-redux";
import { Layout, Menu, Row, Col } from "antd";
import {
  ClusterOutlined, DatabaseOutlined, DeploymentUnitOutlined, InteractionOutlined, FileTextOutlined, FolderOpenOutlined, EyeOutlined, LogoutOutlined,
} from "@ant-design/icons";

import {
  setNotification,
  logout,
} from "../../actions";
import "./styles.css";

const { Header } = Layout;

class TSHeader extends Component {
  render() {
    const { authenticated, user, logout } = this.props;
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
            <Menu
              theme="light"
              mode="horizontal"
              style={{ lineHeight: "64px" }}
              selectedKeys={[`${selectedMenu}`]}
              items={[
                {
                  key: "0",
                  label: (
                    <a href={menuLinks[0]}>
                      <InteractionOutlined />
                      Test Campaign
                    </a>
                  ),
                },
                {
                  key: "1",
                  label: (
                    <a href={menuLinks[1]}>
                      <FolderOpenOutlined />
                      Test Case
                    </a>
                  ),
                },
                {
                  key: "2",
                  label: (
                    <a href={menuLinks[2]}>
                      <ClusterOutlined />
                      Topology
                    </a>
                  ),
                },
                {
                  key: "3",
                  label: (
                    <a href={menuLinks[3]}>
                      <DeploymentUnitOutlined />
                      Simulation
                    </a>
                  ),
                },
                {
                  key: "4",
                  label: (
                    <a href={menuLinks[4]}>
                      <EyeOutlined />
                      Data Recorder
                    </a>
                  ),
                },
                {
                  key: "5",
                  label: (
                    <a href={menuLinks[5]}>
                      <FileTextOutlined />
                      Data Set
                    </a>
                  ),
                },
                {
                  key: "6",
                  label: (
                    <a href={menuLinks[6]}>
                      <DatabaseOutlined />
                      Data Storage
                    </a>
                  ),
                },
                {
                  key: "7",
                  label: (
                    <a href={menuLinks[7]}>
                      <FileTextOutlined />
                      Report
                    </a>
                  ),
                },
                ...(authenticated
                  ? [
                      {
                        key: "logout",
                        label: (
                          <span>
                            <LogoutOutlined />
                            {user ? `Sign out (${user})` : "Sign out"}
                          </span>
                        ),
                        onClick: () => logout(),
                      },
                    ]
                  : []),
              ]}
            />
          </Col>
        </Row>

      </Header>
    );
  }
}

const mapPropsToStates = ({ requesting, auth }) => ({
  requesting,
  authenticated: auth.authenticated,
  user: auth.user,
});

const mapDispatchToProps = (dispatch) => ({
  setNotification: ({ type, message }) =>
    dispatch(setNotification({ type, message })),
  logout: () => dispatch(logout()),
});

export default connect(mapPropsToStates, mapDispatchToProps)(TSHeader);
