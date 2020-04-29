import React, { Component } from "react";
import { connect } from "react-redux";
import { Button, notification, Spin, Alert } from "antd";
// all the edit forms
import ThingModal from "../ThingModal";
import SensorModal from "../SensorModal";
import ActuatorModal from "../ActuatorModal";

import {
  requestModel,
  setModel,
  uploadModel,
  showModal,
  selectThing,
  changeModelName,
  deleteThing,
  changeStatusThing,
  selectSensor,
  deleteSimulationSensor,
  changeStatusSensor,
  selectActuator,
  deleteSimulationActuator,
  changeStatusActuator,
  resetNotification,
  requestDeployStatus,
  selectLogFile,
  requestLogs,
  requestLogsOK,
  requestDeleteLogFile
} from "../../actions";
import JSONView from "../JSONView";
import GraphView from "./GraphView";
import ListView from "../ListView";
import LogView from "../LogView";
import LogFileView from "../LogFileView";

// import 'jsoneditor-react/es/editor.min.css';
import "./styles.css";

// console.log(ace.acequire('editor'));
class MainView extends Component {
  constructor(props) {
    super(props);
    this.state = {
      tempModel: props.model,
      view: props.view,
      logs: props.logs,
      logFile: props.logFile,
      logFiles: props.logFiles,
      deployStatus: props.deployStatus
    };
    this.onModelChange = this.onModelChange.bind(this);
  }

  componentDidMount() {
    this.props.initData();
  }

  componentWillReceiveProps(newProps) {
    this.setState({
      tempModel: newProps.model,
      view: newProps.view,
      deployStatus: newProps.deployStatus,
      logs: newProps.logs,
      logFile: newProps.logFile,
      logFiles: newProps.logFiles
    });
  }

  onModelChange(newModel) {
    this.setState({
      tempModel: newModel
    });
  }

  render() {
    const { view, deployStatus, logs, logFiles, logFile } = this.state;
    const {
      requesting,
      notify,
      model,
      saveModel,
      showModal,
      selectThing,
      deleteThing,
      changeStatusThing,
      selectSensor,
      deleteSensor,
      changeStatusSensor,
      selectActuator,
      deleteActuator,
      changeStatusActuator,
      tool,
      formID,
      resetNotification,
      selectLogFile,
      resetLogFile,
      deleteLogFile,
      changeModelName
    } = this.props;
    let statusMessage = null;
    if (deployStatus) {
      statusMessage = `${
        tool === "simulation" ? "Simulation" : "Data Generator"
      } is running. Model name ${deployStatus.model}. Started time: ${new Date(
        deployStatus.startedTime
      )}`;
    }
    return (
      <div className="content">
        {statusMessage && (
          <Alert
            message={statusMessage}
            type="info"
            style={{ marginBottom: "10px" }}
            showIcon
          />
        )}
        {notify &&
          notification[notify.type]({
            message: notify.type.toUpperCase(),
            description:
              typeof notify.message === "object"
                ? JSON.stringify(notify.message)
                : notify.message,
            onClose: () => resetNotification()
          })}
        {requesting ? (
          <Spin tip="Loading..." />
        ) : view.contentType === "logs" ? (
          logs ? (
            <LogView
              logs={logs}
              logFile={logFile}
              resetLogFile={() => resetLogFile()}
            />
          ) : (
            <LogFileView
              logFiles={logFiles}
              selectLogFile={file => selectLogFile(file)}
              deleteHandler={file => deleteLogFile(file)}
            />
          )
        ) : (
          <div>
            {view.viewType === "json" ? (
              <JSONView value={model} onChange={this.onModelChange} />
            ) : view.viewType === "graph" ? (
              <GraphView model={model} onChange={this.onModelChange} />
            ) : (
              <ListView
                model={model}
                modelType={tool === 'simulation' ? "Simulation" : "Data Geneartor"}
                actions={{
                  showModal,
                  selectThing,
                  deleteThing,
                  changeStatusThing,
                  selectSensor,
                  deleteSensor,
                  changeStatusSensor,
                  selectActuator,
                  deleteActuator,
                  changeStatusActuator,
                  changeModelName,
                }}
              />
            )}
            <Button
              type="primary"
              onClick={() => saveModel(this.state.tempModel)}
              style={{ marginTop: "10px" }}
            >
              Save
            </Button>
          </div>
        )}
        {formID === "THING-FORM" && <ThingModal />}
        {tool === "simulation" && formID === "ACTUATOR-FORM" && (
          <ActuatorModal />
        )}
        {(formID === "SENSOR-FORM" || (formID === "ACTUATOR-FORM" && tool==="data-generator")) && (
          <SensorModal />
        )}
      </div>
    );
  }
}

const mapPropsToStates = ({
  requesting,
  view,
  notify,
  model,
  tool,
  editingForm,
  deployStatus,
  logs
}) => ({
  model,
  view,
  notify,
  requesting,
  tool,
  logs: logs.logs,
  logFiles: logs.logFiles,
  logFile: logs.file,
  deployStatus,
  formID: editingForm.formID
});

const mapDispatchToProps = dispatch => ({
  initData: () => {
    dispatch(requestModel());
    dispatch(requestDeployStatus());
  },
  saveModel: newModel => {
    dispatch(setModel(newModel));
    dispatch(uploadModel());
  },
  showModal: formID => dispatch(showModal(formID)),
  changeModelName: newName => dispatch(changeModelName(newName)),
  selectThing: thing => dispatch(selectThing(thing)),
  deleteThing: thingID => dispatch(deleteThing(thingID)),
  changeStatusThing: (thingID) => dispatch(changeStatusThing(thingID)),
  selectSensor: sensor => dispatch(selectSensor(sensor)),
  deleteSensor: (sensorID, thingID) => dispatch(deleteSimulationSensor({ sensorID, thingID })),
  changeStatusSensor: (sensorID, thingID) => dispatch(changeStatusSensor({ sensorID, thingID })),
  selectActuator: actuator => dispatch(selectActuator(actuator)),
  deleteActuator: (actuatorID, thingID) => dispatch(deleteSimulationActuator({ actuatorID, thingID })),
  changeStatusActuator: (actuatorID, thingID) => dispatch(changeStatusActuator({ actuatorID, thingID })),
  resetNotification: () => dispatch(resetNotification()),
  selectLogFile: file => {
    dispatch(selectLogFile(file));
    dispatch(requestLogs());
  },
  resetLogFile: () => {
    dispatch(selectLogFile(null));
    dispatch(requestLogsOK(null));
  },
  deleteLogFile: file => {
    dispatch(requestDeleteLogFile(file));
  }
});

export default connect(mapPropsToStates, mapDispatchToProps)(MainView);
