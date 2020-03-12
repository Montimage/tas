import React, { Component } from "react";
import { connect } from "react-redux";
import { Button, notification, Spin, Alert } from "antd";
// all the edit forms
import ThingModal from "../ThingModal";
import SensorModal from "../SensorModal";
import ActuatorModal from "../ActuatorModal";
import DataStorageModal from "../DataStorageModal";

import {
  requestModel,
  setModel,
  uploadModel,
  showModal,
  selectThing,
  deleteThing,
  selectSensor,
  deleteSimulationSensor,
  deleteDGSensor,
  selectActuator,
  deleteSimulationActuator,
  deleteDGActuator,
  resetNotification,
  requestDeployStatus
} from "../../actions";
import JSONView from "../JSONView";
import GraphView from "./GraphView";
import ListView from "../ListView";
import LogView from "../LogView";
// import 'jsoneditor-react/es/editor.min.css';
import "./styles.css";

// console.log(ace.acequire('editor'));
class MainView extends Component {
  constructor(props) {
    super(props);
    this.state = {
      tempModel: props.model,
      view: props.view
    };
    this.onModelChange = this.onModelChange.bind(this);
  }

  componentDidMount() {
    this.props.fetchModel();
    this.props.fetchDeployStatus();
  }

  componentWillReceiveProps(newProps) {
    this.setState({
      tempModel: newProps.model,
      view: newProps.view
    });
  }

  onModelChange(newModel) {
    this.setState({
      tempModel: newModel
    });
  }

  render() {
    const { view } = this.state;
    const {
      requesting,
      notify,
      model,
      saveModel,
      showModal,
      selectThing,
      deleteThing,
      selectSensor,
      deleteSensor,
      selectActuator,
      deleteActuator,
      tool,
      logs,
      formID,
      resetNotification,
      isRunning
    } = this.props;
    let deployStatus = null;
    if (isRunning) {
      if (tool === 'simulation') {
        deployStatus = 'Simulation is running...';
      } else {
        deployStatus = 'Data Generator is running...';
      }
    }
    return (
      <div className="content">
        {deployStatus &&
          <Alert message={deployStatus} type="info" style={{marginBottom: '10px'}} showIcon/>
        }
        {notify &&
          notification[notify.type]({
            message: notify.type.toUpperCase(),
            description: typeof notify.message === 'object' ? JSON.stringify(notify.message) : notify.message,
            onClose: () => resetNotification()
          })
        }
        {requesting ? (
          <Spin tip="Loading..." />
        ) : view.contentType === "logs" ? (
          <LogView logs={logs}/>
        ) : (
          <div>
            {view.viewType === "json" ? (
              <JSONView value={model} onChange={this.onModelChange} />
            ) : view.viewType === "graph" ? (
              <GraphView model={model} onChange={this.onModelChange} />
            ) : (
              <ListView
                model={model}
                actions={{
                  showModal,
                  selectThing,
                  deleteThing,
                  selectSensor,
                  deleteSensor,
                  selectActuator,
                  deleteActuator
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
        {tool === "simulation" && formID === "THING-FORM" && <ThingModal />}
        {tool === "simulation" && formID === "ACTUATOR-FORM" && (
          <ActuatorModal />
        )}
        {tool === "data-generator" && formID === "DATA-STORAGE-FORM" && (
          <DataStorageModal />
        )}
        <SensorModal />
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
  isRunning,
  logs,
}) => ({
  model,
  view,
  notify,
  requesting,
  tool,
  logs,
  isRunning,
  formID: editingForm.formID
});

const mapDispatchToProps = dispatch => ({
  fetchModel: () => dispatch(requestModel()),
  fetchDeployStatus: () => dispatch(requestDeployStatus()),
  saveModel: newModel => {
    dispatch(setModel(newModel));
    dispatch(uploadModel());
  },
  showModal: formID => dispatch(showModal(formID)),
  selectThing: thing => dispatch(selectThing(thing)),
  deleteThing: thingID => dispatch(deleteThing(thingID)),
  selectSensor: sensor => dispatch(selectSensor(sensor)),
  deleteSensor: (sensorID, thingID) => {
    if (thingID) {
      dispatch(deleteSimulationSensor({ sensorID, thingID }));
    } else {
      dispatch(deleteDGSensor(sensorID));
    }
  },
  selectActuator: actuator => dispatch(selectActuator(actuator)),
  deleteActuator: (actuatorID, thingID) => {
    if (thingID) {
      dispatch(deleteSimulationActuator({ actuatorID, thingID }));
    } else {
      dispatch(deleteDGActuator(actuatorID));
    }
  },
  resetNotification: () => dispatch(resetNotification())
});

export default connect(mapPropsToStates, mapDispatchToProps)(MainView);
