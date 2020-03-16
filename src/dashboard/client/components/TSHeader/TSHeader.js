import React, { Component } from "react";
import { connect } from "react-redux";
import { Layout, Menu, Row, Col, Select, Typography } from "antd";
import {
  CaretRightOutlined,
  GatewayOutlined,
  ProfileOutlined,
  DeploymentUnitOutlined,
  StopOutlined,
  ImportOutlined,
  ClearOutlined,
  SyncOutlined,
  ExportOutlined
} from "@ant-design/icons";

const { SubMenu } = Menu;
const { Header } = Layout;
const { Text } = Typography;

import {
  setModel,
  resetModel,
  sendDeployStart,
  sendDeployStop,
  setContentType,
  setNotification,
  changeTool,
  requestModel,
  requestLogFiles,
  requestDeployStatus,
  selectLogFile,
  requestLogsOK,
  requestLogFilesOK
} from "../../actions";
import "./styles.css";

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
      isRunning,
      viewLogs,
      setContentType,
      model,
      tool,
      changeTool
    } = this.props;
    const logo =
      tool === "simulation"
        ? "img/logo-simulation.png"
        : "img/logo-data-generator.png";
    return (
      <Header>
        <Row>
          <Col span={4}>
            <a href="/">
              <img
                src={logo}
                className="logo"
                style={{ maxWidth: "250px", objectFit: "contain" }}
              />
            </a>
          </Col>
          <Col span={14} push={6}>
            <Menu theme="dark" mode="horizontal" style={{ lineHeight: "64px" }}>
              <SubMenu
                title={
                  <span
                    className="submenu-title-wrapper"
                    onClick={() => setContentType("model")}
                  >
                    <GatewayOutlined />
                    Model
                  </span>
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
                    {"Deploy "}
                    {isRunning ? <SyncOutlined spin /> : null}
                  </span>
                }
              >
                <Menu.Item key="deploy:1" onClick={startDeploy}>
                  <CaretRightOutlined />
                  Deploy
                </Menu.Item>
                <Menu.Item key="deploy:2" onClick={stopDeploy}>
                  <StopOutlined />
                  Terminate
                </Menu.Item>
              </SubMenu>
              <Menu.Item key="3" onClick={viewLogs}>
                {" "}
                <ProfileOutlined />
                Logs
              </Menu.Item>
              <Menu.Item key="4" onClick={changeTool}>
                {" "}
                <ExportOutlined />
                <Text style={{color: '#ffff00fc'}}>
                  {tool === "simulation" ? "Data Generator" : "Simulation"}
                </Text>
              </Menu.Item>
            </Menu>
          </Col>
        </Row>

        <input
          type="file"
          onChange={event => this.onUpload(event.target.files)}
          ref={input => {
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

const mapPropsToStates = ({ requesting, model, tool, isRunning }) => ({
  requesting,
  model,
  tool,
  isRunning
});

const mapDispatchToProps = dispatch => ({
  changeTool: () => {
    dispatch(changeTool());
    dispatch(requestModel());
    dispatch(setContentType('model'));
    dispatch(requestDeployStatus());
    dispatch(requestLogsOK(null));
    dispatch(requestLogFilesOK([]));
    dispatch(selectLogFile(null));
  },
  setNotification: ({ type, message }) =>
    dispatch(setNotification({ type, message })),
  setNewModel: newModel => {
    dispatch(setModel(newModel));
    dispatch(setContentType("model"));
  },
  resetEditor: () => {
    dispatch(resetModel());
    dispatch(setContentType("model"));
  },
  startDeploy: () => dispatch(sendDeployStart()),
  stopDeploy: () => dispatch(sendDeployStop()),
  viewLogs: () => {
    dispatch(requestLogFiles());
    dispatch(setContentType("logs"));
    dispatch(selectLogFile(null));
  },
  setContentType: v => dispatch(setContentType(v))
});

export default connect(mapPropsToStates, mapDispatchToProps)(TSHeader);
