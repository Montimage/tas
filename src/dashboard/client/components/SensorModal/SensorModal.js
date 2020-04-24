import React, { Component } from "react";
import { connect } from "react-redux";
import TSModal from "../TSModal";
import {
  addSimulationSensor,
  addDGSensor,
  addDGActuator,
  showModal,
  selectActuator,
  selectSensor,
} from "../../actions";
import { Form, Button, Alert } from "antd";
import { updateObjectByPath, deepCloneObject } from "../../utils";
import { FormTextItem, FormSelectItem, FormSwitchItem } from "../FormItems";
// import DatabaseConfigForm from "../DatabaseConfigForm";
import DataReplayerForm from "./DataReplayerForm";
import DataGeneratorForm from "./DataGeneratorForm";

const replayDataSource = () => ({
  connConfig: {
    host: "localhost",
    port: 27017,
    username: null,
    password: null,
    options: null,
  },
  devId: null,
  dbname: null,
  startTime: Date.now(),
  endTime: Date.now(),
});

const generateDataSource = () => ({
  timePeriod: 5,
  scale: 1,
  dosAttackSpeedUpRate: 5,
  timeBeforeFailed: 20,
  sensorBehaviours: [],
  withEnergy: false,
  isIPSOFormat: false,
  energy: null,
  sources: [],
});

const initSensor = () => ({
  instanceId: `instanceId-${Date.now()}`,
  objectId: null,
  name: `name-${Date.now()}`,
  enable: true,
  isFromDatabase: false,
  options: null,
  userData: null,
  dataSource: generateDataSource(),
});

class SensorModal extends Component {
  constructor(props) {
    super(props);

    const { tool, model, selectedSensor, selectedActuator, formID } = props;
    const thingIDs = [];
    if (tool === "simulation" && model.things) {
      const { things } = model;
      for (let index = 0; index < things.length; index++) {
        thingIDs.push(things[index].id);
      }
    }
    let selectedData =
      formID === "SENSOR-FORM"
        ? selectedSensor
        : formID === "ACTUATOR-FORM"
        ? selectedActuator
        : null;
    let replayDS = deepCloneObject(replayDataSource());
    let generateDS = deepCloneObject(generateDataSource());
    let data = initSensor();
    console.log(data);
    if (selectedData) {
      data = deepCloneObject(selectedData);
      if (data.isFromDatabase) {
        replayDS = data.dataSource;
      } else {
        generateDS = data.dataSource;
      }
    }
    this.state = {
      data,
      thingID: thingIDs[0],
      thingIDs,
      replayDS,
      generateDS,
      error: null,
    };
  }

  componentWillReceiveProps(newProps) {
    const { tool, model, selectedSensor, selectedActuator, formID } = newProps;

    const thingIDs = [];
    if (tool === "simulation" && model.things) {
      const { things } = model;
      for (let index = 0; index < things.length; index++) {
        thingIDs.push(things[index].id);
      }
    }
    let selectedData =
      formID === "SENSOR-FORM"
        ? selectedSensor
        : formID === "ACTUATOR-FORM"
        ? selectedActuator
        : null;
    let replayDS = deepCloneObject(replayDataSource());
    let generateDS = deepCloneObject(generateDataSource());
    let data = initSensor();
    if (selectedData) {
      data = deepCloneObject(selectedData);
      if (data.isFromDatabase) {
        replayDS = data.dataSource;
      } else {
        generateDS = data.dataSource;
      }
    }
    this.setState({
      data,
      thingID: thingIDs[0],
      thingIDs,
      replayDS,
      generateDS,
      error: null,
    });
  }

  onThingChange(tID) {
    this.setState({ thingID: tID });
  }

  onChangeDataSource(isReplay) {
    if (isReplay) {
      this.setState((prevState) => {
        const newData = { ...prevState.data };
        updateObjectByPath(newData, "dataSource", prevState.replayDS);
        updateObjectByPath(newData, "isFromDatabase", true);
        return { data: newData, error: null, generateDS: prevState.generateDS };
      });
    } else {
      this.setState((prevState) => {
        const newData = { ...prevState.data };
        updateObjectByPath(newData, "dataSource", prevState.generateDS);
        updateObjectByPath(newData, "isFromDatabase", false);
        return { data: newData, error: null, replayDS: prevState.replayDS };
      });
    }
  }
  onDataChange(dataPath, value) {
    this.setState((prevState) => {
      const newData = { ...prevState.data };
      console.log(dataPath, value);
      updateObjectByPath(newData, dataPath, value);
      return { data: newData, error: null };
    });
  }

  handleOk() {
    const { thingID, data } = this.state;
    const {
      tool,
      formID,
      addSimulationSensor,
      addDGSensor,
      addDGActuator,
      showModal,
    } = this.props;
    if (formID === "SENSOR-FORM") {
      // Add new sensor
      if (tool === "simulation") {
        // Add sensor to a simulation model
        addSimulationSensor(thingID, data);
        showModal(null);
        this.props.selectSensor(null);
      } else if (tool === "data-generator") {
        // add sensor to a data-generator model
        addDGSensor(data);
        showModal(null);
        this.props.selectSensor(null);
      } else {
        console.log(`[ERROR] Undefined tool: ${tool}`);
        this.setState({ error: `[ERROR] Undefined tool: ${tool}` });
      }
    } else if (formID === "ACTUATOR-FORM") {
      // Add new actuator
      if (tool === "data-generator") {
        // add actuator to a data-generator model
        addDGActuator(data);
        showModal(null);
        this.props.selectActuator(null);
      } else {
        console.log(
          `[ERROR] Undefined tool or invalid form: ${tool}, ${formID}`
        );
        this.setState({
          error: `[ERROR] Undefined tool or invalid form: ${tool}, ${formID}`,
        });
      }
    } else {
      console.log(`[ERROR] Invalid form: ${formID}`);
      this.setState({ error: `[ERROR] Invalid form: ${formID}` });
    }
  }

  handleCancel() {
    this.props.showModal(null);
    this.props.selectSensor(null);
    this.props.selectActuator(null);
  }

  handleDuplicate() {
    const { thingID } = this.state;
    const {
      tool,
      formID,
      addSimulationSensor,
      addDGSensor,
      addDGActuator,
      showModal,
      selectSensor,
      selectActuator,
    } = this.props;

    if (formID === "SENSOR-FORM") {
      const newThingID = `sensor-${Date.now()}`;
      const newData = {
        ...this.state.data,
        id: newThingID,
        name: "New Sensor",
      };
      // Add new sensor
      if (tool === "simulation") {
        // Add sensor to a simulation model
        addSimulationSensor(thingID, newData);
        selectSensor(newData);
        setTimeout(() => {
          showModal("SENSOR-FORM");
        }, 1000);
        showModal(null);
      } else if (tool === "data-generator") {
        // add sensor to a data-generator model
        addDGSensor(newData);
        setTimeout(() => {
          selectSensor(newData);
          showModal("SENSOR-FORM");
        }, 1000);
        showModal(null);
      } else {
        console.log(`[ERROR] Undefined tool: ${tool}`);
        this.setState({ error: `[ERROR] Undefined tool: ${tool}` });
      }
    } else if (formID === "ACTUATOR-FORM") {
      // Add new actuator
      const newThingID = `act-${Date.now()}`;
      const newData = {
        ...this.state.data,
        id: newThingID,
        name: "New Actuator",
      };
      if (tool === "data-generator") {
        // add actuator to a data-generator model
        addDGActuator(newData);
        setTimeout(() => {
          showModal("ACTUATOR-FORM");
        }, 1000);
        selectActuator(newData);
        showModal(null);
      } else {
        console.log(
          `[ERROR] Undefined tool or invalid form: ${tool}, ${formID}`
        );
        this.setState({
          error: `[ERROR] Undefined tool or invalid form: ${tool}, ${formID}`,
        });
      }
    } else {
      console.log(`[ERROR] Invalid form: ${formID}`);
      this.setState({ error: `[ERROR] Invalid form: ${formID}` });
    }
  }

  render() {
    const { data, error, thingID, thingIDs } = this.state;
    const { tool, formID, selectedActuator, selectedSensor } = this.props;
    if (tool === "simulation" && formID === "ACTUATOR-FORM") return null;
    let footer = null;
    if (
      (selectedSensor && formID === "SENSOR-FORM") ||
      (selectedActuator && formID === "ACTUATOR-FORM")
    ) {
      footer = [
        <Button key="duplicate" onClick={() => this.handleDuplicate()}>
          Duplicate
        </Button>,
        <Button key="cancel" onClick={() => this.handleCancel()}>
          Cancel
        </Button>,
        <Button key="ok" type="primary" onClick={() => this.handleOk()}>
          OK
        </Button>,
      ];
    } else {
      footer = [
        <Button key="cancel" onClick={() => this.handleCancel()}>
          Cancel
        </Button>,
        <Button key="ok" type="primary" onClick={() => this.handleOk()}>
          OK
        </Button>,
      ];
    }
    const isSensor = formID === "SENSOR-FORM" ? true : false;

    return (
      <TSModal
        title={`${isSensor ? "Sensor" : "Actuator"}`}
        visible={
          isSensor || (tool === "data-generator" && formID === "ACTUATOR-FORM")
        }
        onCancel={() => this.handleCancel()}
        footer={footer}
      >
        <Form
          labelCol={{
            span: 4,
          }}
          wrapperCol={{
            span: 14,
          }}
        >
          {tool === "simulation" && (
            <FormSelectItem
              label="Thing"
              defaultValue={thingID}
              onChange={(v) => this.onThingChange(v)}
              options={thingIDs}
            />
          )}
          <FormTextItem
            label="Instance Id"
            defaultValue={data.instanceId}
            onChange={(v) => this.onDataChange("instanceId", v)}
            placeholder="Identify of the device"
          />
          <FormTextItem
            label="Object Id"
            defaultValue={data.objectId}
            onChange={(v) => this.onDataChange("objectId", v)}
            placeholder="Identify of the type of device (IPSO Standard)"
          />
          <FormTextItem
            label="Name"
            defaultValue={data.name}
            onChange={(v) => this.onDataChange("name", v)}
          />
          <FormTextItem
            label="Options"
            defaultValue={data.options ? data.options.topic : null}
            onChange={(v) => this.onDataChange("options", { topic: v })}
            placeholder="Options in JSON format"
          />
          <FormTextItem
            label="User Data"
            defaultValue={JSON.stringify(data.userData)}
            onChange={(v) => this.onDataChange("userData", v)}
            placeholder="User data in JSON format"
          />
          <FormSwitchItem
            label="Enable"
            onChange={(v) => this.onDataChange(`enable`, v)}
            checked={data.enable ? true : false}
            checkedChildren={"On"}
            unCheckedChildren={"Off"}
          />
          <FormSelectItem
            label="Data Source"
            defaultValue={data.isFromDatabase ? "Replay" : "Generate"}
            onChange={(v) => {
              this.onChangeDataSource(v === "Replay" ? true : false);
            }}
            options={["Replay", "Generate"]}
          />
          {data.isFromDatabase ? (
            <DataReplayerForm
              dataPath={"dataSource"}
              dataSource={data.dataSource}
              onDataChange={(dataPath, value) =>
                this.onDataChange(dataPath, value)
              }
            />
          ) : (
            <DataGeneratorForm
              dataPath={"dataSource"}
              dataSource={data.dataSource}
              onDataChange={(dataPath, value) =>
                this.onDataChange(dataPath, value)
              }
            />
          )}
        </Form>
        {error && <Alert message={error} type="error" />}
      </TSModal>
    );
  }
}

const mapPropsToStates = ({ editingForm, model, tool }) => ({
  formID: editingForm.formID,
  selectedSensor: editingForm.selectedSensor,
  selectedActuator: editingForm.selectedActuator,
  model,
  tool,
});

const mapDispatchToProps = (dispatch) => ({
  showModal: (modalID) => dispatch(showModal(modalID)),
  addSimulationSensor: (thingID, data) =>
    dispatch(addSimulationSensor({ thingID, sensor: data })),
  addDGSensor: (data) => dispatch(addDGSensor(data)),
  addDGActuator: (data) => dispatch(addDGActuator(data)),
  // deleteSimulationSensor: (id, thingID) =>
  //   dispatch(deleteSimulationSensor({ thingID, sensorID: id })),
  // deleteDGSensor: id => dispatch(deleteDGSensor(id)),
  // deleteDGActuator: id => dispatch(deleteDGActuator(id)),
  selectActuator: (act) => dispatch(selectActuator(act)),
  selectSensor: (sensor) => dispatch(selectSensor(sensor)),
});

export default connect(mapPropsToStates, mapDispatchToProps)(SensorModal);
