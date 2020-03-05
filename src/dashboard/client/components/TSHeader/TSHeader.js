import React, {Component} from "react";
import { connect } from "react-redux";
import { Layout, Menu, Row, Col } from "antd";
import {
  CaretRightOutlined,
  GatewayOutlined,
  ProfileOutlined,
  DeploymentUnitOutlined,
  StopOutlined,
  CloudDownloadOutlined,
  CloudUploadOutlined,
  ClearOutlined,
  SyncOutlined,
} from "@ant-design/icons";

const { SubMenu } = Menu;
const { Header } = Layout;

import {
  setModel,
  resetModel,
  sendDeployStart,
  sendDeployStop,
  setContentType,
  setError,
  requestLogs,
} from "../../actions";
import "./styles.css";

class TSHeader extends Component {

  onUpload (files) {
    const fileReader = new FileReader();
    fileReader.onloadend = () => {
      try {
        const newModel = JSON.parse(fileReader.result);
        this.props.setNewModel(newModel);
      } catch (error) {
        this.props.setError(error);
      }
    };
    fileReader.readAsText(files[0]);
  }

  exportModel(model) {
    if (model) {
      const fileData = JSON.stringify(model);
      const blob = new Blob([fileData], {type: 'text/json'});
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = `${model.name.replace(/ /g,'')}.json`;
      link.href = url;
      link.click();
    }
  }

  render () {
    const {
      resetEditor,
      startDeploy,
      stopDeploy,
      isExecuting,
      viewLogs,
      setContentType,
      model
    } = this.props;
    return (
      <Header>
        <Row>
          <Col span={6}>
            <img src="img/Logo.png" className="logo" style={{maxWidth: '250px', objectFit:'contain'}}/>
          </Col>
          <Col span={18}>
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
                  <CloudUploadOutlined /> Import Model
                </Menu.Item>
                <Menu.Item
                  key="model:2"
                  onClick={() => this.exportModel(model)}
                >
                  <CloudDownloadOutlined />
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
                    {isExecuting ? (
                      <SyncOutlined spin twoToneColor="#52c41a" />
                    ) : null}
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

const mapPropsToStates = ({ requesting, model}) => ({
  requesting,
  model
});


const mapDispatchToProps = dispatch => ({
  setError: (err) => dispatch(setError(err)),
  setNewModel: (newModel) => {
    dispatch(setModel(newModel));
    dispatch(setContentType('model'));
  },
  resetEditor: () => {
    dispatch(resetModel());
    dispatch(setContentType('model'));
  },
  startDeploy: () => dispatch(sendDeployStart()),
  stopDeploy: () => dispatch(sendDeployStop()),
  viewLogs: () => {
    dispatch(requestLogs());
    dispatch(setContentType('logs'));
  },
  setContentType: (v) => dispatch(setContentType(v))
});

export default connect(mapPropsToStates, mapDispatchToProps)(TSHeader);