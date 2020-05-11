import React, { Component } from "react";
import { connect } from "react-redux";
import { Button } from "antd";
// all the edit forms
import ThingModal from "../components/ThingModal";
import SensorModal from "../components/SensorModal";
import ActuatorModal from "../components/ActuatorModal";

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
} from "../actions";
import JSONView from "../components/JSONView";
import GraphView from "../components/GraphView";
import ListView from "../components/ListView";
import LayoutPage from "./LayoutPage";

import { isDataGenerator, getQuery } from "../utils";

// console.log(ace.acequire('editor'));
class ModelPage extends Component {
  constructor(props) {
    super(props);
    this.state = {
      tempModel: props.model,
      isDG: false,
    };
    this.onModelChange = this.onModelChange.bind(this);
  }

  componentDidMount() {
    const isDG = isDataGenerator();
    this.props.initData(isDG);
    this.setState({ isDG });
  }

  componentWillReceiveProps(newProps) {
    this.setState({
      tempModel: newProps.model,
    });
  }

  onModelChange(newModel) {
    this.setState({
      tempModel: newModel,
    });
  }

  render() {
    const { isDG } = this.state;
    const {
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
      formID,
      changeModelName,
    } = this.props;

    let viewType = getQuery("view");
    if (!viewType) viewType = "list";
    return (
      <LayoutPage>
        {viewType === "json" ? (
          <JSONView value={model} onChange={this.onModelChange} />
        ) : viewType === "graph" ? (
          <GraphView model={model} onChange={this.onModelChange} />
        ) : (
          <ListView
            model={model}
            modelType={!isDG ? "Simulation" : "Data Geneartor"}
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
          onClick={() => saveModel(isDG, this.state.tempModel)}
          style={{ marginTop: "10px" }}
        >
          Save
        </Button>
        {formID === "THING-FORM" && <ThingModal />}
        {!isDG && formID === "ACTUATOR-FORM" && <ActuatorModal />}
        {(formID === "SENSOR-FORM" || (formID === "ACTUATOR-FORM" && isDG)) && (
          <SensorModal />
        )}
      </LayoutPage>
    );
  }
}

const mapPropsToStates = ({
  requesting,
  notify,
  model,
  editingForm,
  deployStatus,
}) => ({
  model,
  notify,
  requesting,
  deployStatus,
  formID: editingForm.formID,
});

const mapDispatchToProps = (dispatch) => ({
  initData: (isDG) => {
    dispatch(requestModel(isDG));
  },
  saveModel: (isDG, newModel) => {
    dispatch(setModel(newModel));
    dispatch(uploadModel(isDG));
  },
  showModal: (formID) => dispatch(showModal(formID)),
  changeModelName: (newName) => dispatch(changeModelName(newName)),
  selectThing: (thing) => dispatch(selectThing(thing)),
  deleteThing: (thingID) => dispatch(deleteThing(thingID)),
  changeStatusThing: (thingID) => dispatch(changeStatusThing(thingID)),
  selectSensor: (sensor) => dispatch(selectSensor(sensor)),
  deleteSensor: (sensorID, thingID) =>
    dispatch(deleteSimulationSensor({ sensorID, thingID })),
  changeStatusSensor: (sensorID, thingID) =>
    dispatch(changeStatusSensor({ sensorID, thingID })),
  selectActuator: (actuator) => dispatch(selectActuator(actuator)),
  deleteActuator: (actuatorID, thingID) =>
    dispatch(deleteSimulationActuator({ actuatorID, thingID })),
  changeStatusActuator: (actuatorID, thingID) =>
    dispatch(changeStatusActuator({ actuatorID, thingID })),
});

export default connect(mapPropsToStates, mapDispatchToProps)(ModelPage);
