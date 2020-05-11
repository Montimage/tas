import React, { Component } from "react";
import { connect } from "react-redux";
import { Layout, Menu, Row, Col, Typography } from "antd";
import {
  CaretRightOutlined,
  GatewayOutlined,
  ProfileOutlined,
  DeploymentUnitOutlined,
  StopOutlined,
  ImportOutlined,
  ClearOutlined,
  SyncOutlined,
  ExportOutlined,
} from "@ant-design/icons";

import {
  setModel,
  resetModel,
  sendDeployStart,
  sendDeployStop,
  setNotification,
  requestLogFiles,
} from "../../actions";
import "./styles.css";
import { isDataGenerator } from "../../utils";

const { SubMenu } = Menu;
const { Header } = Layout;
const { Text } = Typography;

class TSHeader extends Component {
  onUpload(files) {
    const fileReader = new FileReader();
    fileReader.onloadend = () => {
      try {
        const newModel = JSON.parse(fileReader.result);
        this.props.setNewModel(newModel);
      } catch (error) {
        this.props.setNotification({ type: "error", message: error });
      }
    };
    fileReader.readAsText(files[0]);
  }

  exportModel(model) {
    if (model) {
      const fileData = JSON.stringify(model);
      const blob = new Blob([fileData], { type: "text/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.download = `${model.name.replace(/ /g, "")}.json`;
      link.href = url;
      link.click();
    }
  }

  render() {
    const {
      resetEditor,
      startDeploy,
      stopDeploy,
      deployStatus,
      model,
    } = this.props;
    const isDG = isDataGenerator();
    const logo =
      isDG
        ? "/img/logo-data-generator.png"
        : "/img/logo-simulation.png";
    return (
      <Header>
        <Row>
          <Col span={4}>
            <a href="/">
              <img
                src={logo}
                className="logo"
                alt="Logo"
                style={{ maxWidth: "250px", objectFit: "contain" }}
              />
            </a>
          </Col>
          <Col span={14} push={6}>
            <Menu theme="dark" mode="horizontal" style={{ lineHeight: "64px" }}>
              <SubMenu
                title={
                  <a
                    className="submenu-title-wrapper"
                    href={isDG ? "/data-generator" : "/"}
                  >
                    <GatewayOutlined />
                    Model
                  </a>
                }
              >
                <Menu.Item
                  key="model:1"
                  onClick={() => this.inputFileDOM.click()}
                >
                  <ImportOutlined /> Import Model
                </Menu.Item>
                <Menu.Item
                  key="model:2"
                  onClick={() => this.exportModel(model)}
                >
                  <ExportOutlined />
                  Export Model
                </Menu.Item>
                <Menu.Item key="model:3" onClick={resetEditor}>
                  <ClearOutlined />
                  Reset Editor
                </Menu.Item>
              </SubMenu>
              <SubMenu
                title={
                  <span className="submenu-title-wrapper">
                    <DeploymentUnitOutlined />
                    {isDG ? "Generate" : "Simulate"}
                    {deployStatus ? <SyncOutlined spin /> : null}
                  </span>
                }
              >
                <Menu.Item key="deploy:1" onClick={() => startDeploy(isDG)}>
                  <CaretRightOutlined />
                  {isDG ? "Generate" : "Simulate"}
                </Menu.Item>
                <Menu.Item key="deploy:2" onClick={() => stopDeploy(isDG)}>
                  <StopOutlined />
                  Terminate
                </Menu.Item>
              </SubMenu>
              <Menu.Item key="3">
                <a href={isDG ? "/data-generator/logs" : "/logs"} rel="noopener noreferrer" target="_blank">
                  <ProfileOutlined />
                  Logs
                </a>
              </Menu.Item>
              <Menu.Item key="4">
                <a href={isDG ? "/" : "/data-generator"} rel="noopener noreferrer" target="_blank">
                  <ExportOutlined />
                  <Text style={{ color: "#ffff00fc" }}>
                    {isDG ? "Simulation" : "Data Generator"}
                  </Text>
                </a>
              </Menu.Item>
            </Menu>
          </Col>
        </Row>

        <input
          type="file"
          onChange={(event) => this.onUpload(event.target.files)}
          ref={(input) => {
            this.inputFileDOM = input;
          }}
          style={{ display: "none" }}
          accept=".json"
          multiple={false}
        />
      </Header>
    );
  }
}

const mapPropsToStates = ({ requesting, model, deployStatus }) => ({
  requesting,
  model,
  deployStatus,
});

const mapDispatchToProps = (dispatch) => ({
  setNotification: ({ type, message }) =>
    dispatch(setNotification({ type, message })),
  setNewModel: (newModel) => {
    dispatch(setModel(newModel));
  },
  resetEditor: () => {
    dispatch(resetModel());
  },
  startDeploy: (isDG) => dispatch(sendDeployStart(isDG)),
  stopDeploy: (isDG) => dispatch(sendDeployStop(isDG)),
  viewLogs: () => {
    dispatch(requestLogFiles());
  }
});

export default connect(mapPropsToStates, mapDispatchToProps)(TSHeader);
