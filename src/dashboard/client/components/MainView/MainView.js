import React, { Component } from "react";
import { connect } from "react-redux";
import { Button } from "antd";
// all the edit forms
import ThingModal from '../ThingModal';
import SensorModal from '../SensorModal';
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
  deleteDGActuator
} from "../../actions";
import JSONView from "../JSONView";
import GraphView from "./GraphView";
import ListView from "../ListView";
// import 'jsoneditor-react/es/editor.min.css';
import "./styles.css";

// console.log(ace.acequire('editor'));
class MainView extends Component {
  constructor(props) {
    super(props);
    this.state = {
      tempModel: props.model
    };
    this.onModelChange = this.onModelChange.bind(this);
  }

  componentDidMount() {
    this.props.fetchModel();
  }

  componentWillReceiveProps(newProps) {
    this.setState({
      tempModel: newProps.model
    })
  }

  onModelChange(newModel) {
    this.setState({
      tempModel: newModel
    });
  }

  render() {
    const {
      requesting,
      view,
      error,
      model,
      logs,
      saveModel,
      showModal,
      selectThing,
      deleteThing,
      selectSensor,
      deleteSensor,
      selectActuator,
      deleteActuator,
      tool,
      formID
    } = this.props;
    return (
      <div className="content">
        {requesting ? (
          <span>Loading ...</span>
        ) : error ? (
          <span> There are some error {error}</span>
        ) : view.contentType === "logs" ? (
          <p>{logs}</p>
        ) : (
          <div>
            {view.viewType === "json" ? (
              <JSONView value={model} onChange={this.onModelChange} />
            ) : view.viewType === "graph" ? (
              <GraphView model={model} onChange={this.onModelChange} />
            ) : (
              <ListView model={model} actions={{
                showModal,
                selectThing,
                deleteThing,
                selectSensor,
                deleteSensor,
                selectActuator,
                deleteActuator
              }} />
            )}
            <Button
              type="default"
              shape="round"
              onClick={() => saveModel(this.state.tempModel)}
              style={{ marginTop: "10px" }}
            >
              Save
            </Button>
          </div>
        )}
        {tool === 'simulation' && formID==='THING-FORM' && <ThingModal />}
        {tool === 'simulation' && formID==='ACTUATOR-FORM' && <ActuatorModal />}
        {tool === 'data-generator' && formID==='DATA-STORAGE-FORM' && <DataStorageModal />}
        <SensorModal />
      </div>
    );
  }
}

const mapPropsToStates = ({ requesting, view, error, model, logs, tool, editingForm }) => ({
  model,
  logs,
  view,
  error,
  requesting,
  tool,
  formID: editingForm.formID
});

const mapDispatchToProps = dispatch => ({
  fetchModel: () => dispatch(requestModel()),
  saveModel: newModel => {
    dispatch(setModel(newModel));
    dispatch(uploadModel());
  },
  showModal: (formID) => dispatch(showModal(formID)),
  selectThing: (thing) => dispatch(selectThing(thing)),
  deleteThing: (thingID) => dispatch(deleteThing(thingID)),
  selectSensor: (sensor) => dispatch(selectSensor(sensor)),
  deleteSensor: (sensorID, thingID) => {
    if (thingID) {
      dispatch(deleteSimulationSensor({sensorID, thingID}));
    } else {
      dispatch(deleteDGSensor(sensorID));
    }
  },
  selectActuator: (actuator) => dispatch(selectActuator(actuator)),
  deleteActuator: (actuatorID, thingID) => {
    if (thingID) {
      dispatch(deleteSimulationActuator({actuatorID, thingID}));
    } else {
      dispatch(deleteDGActuator(actuatorID));
    }
  },
});

export default connect(mapPropsToStates, mapDispatchToProps)(MainView);
