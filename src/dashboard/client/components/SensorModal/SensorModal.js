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
import {
  FormTextItem,
  FormSelectItem,
  FormNumberItem,
  FormSwitchItem,
} from "../FormItems";
// import DatabaseConfigForm from "../DatabaseConfigForm";
import FormNumberWithRange from "../FormNumberWithRange";
import LocationForm from "../LocationForm";
import DataReplayerForm from './DataReplayerForm';
import DataGeneratorForm from './DataGeneratorForm';

const DEFAULT_TIME_INTERVAL = 3; // 3 seconds

const initDataDescriptionBoolean = {
  type: "Boolean",
  timeInterval: DEFAULT_TIME_INTERVAL,
  initValue: 1,
};

const initDataDescriptionEnum = {
  type: "Enum",
  timeInterval: DEFAULT_TIME_INTERVAL,
  initValue: 1,
};

const initDataDescriptionInteger = {
  type: "Integer",
  timeInterval: DEFAULT_TIME_INTERVAL,
  min: 0,
  max: 10000,
  initValue: 10,
  regular: {
    min: 10,
    max: 20,
    step: 1,
  },
  behaviour: "Normal",
};

const initDataDescriptionDouble = {
  type: "Integer",
  timeInterval: DEFAULT_TIME_INTERVAL,
  min: 0,
  max: 10000,
  initValue: 10,
  regular: {
    min: 10,
    max: 20,
    step: 1,
  },
  behaviour: "Normal",
};

const initDataDescriptionLocation = {
  type: "Location",
  timeInterval: DEFAULT_TIME_INTERVAL,
  initValue: {
    lat: 48.828886,
    lng: 2.353675,
  },
  bearingDirection: 90,
  velo: 50,
  behaviour: "Normal",
};

const dataDescriptions = {
  Boolean: initDataDescriptionBoolean,
  Enum: initDataDescriptionEnum,
  Integer: initDataDescriptionInteger,
  Double: initDataDescriptionDouble,
  Location: initDataDescriptionLocation,
};

const replayDataSource = {
  connConfig: {
    host: "localhost",
    port: 27017,
    username: null,
    password: null,
    options: null,
  },
  devID: null,
  dbname: null,
  startTime: null,
  endTime: null,
};

const generateDataSource = {
  timePeriod: 5,
  scale: 1,
  dosAttackSpeedupRateL: 5,
  timeBeforeFailed: 20,
  sensorBehaviours: [],
  energy: null,
  sources: []
};

const initSensor = {
  id: `id-${Date.now()}`,
  name: `name-${Date.now()}`,
  enable: true,
  isFromDatabase: false,
  options: null,
  userData: null,
  dataSource: generateDataSource,
};

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
    this.state = {
      data: selectedData ? deepCloneObject(selectedData) : initSensor,
      thingID: thingIDs[0],
      thingIDs,
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
    let selectedData = null;
    if (formID === null)
      selectedData = selectedSensor ? selectedSensor : selectedActuator;
    if (!selectedData) {
      selectedData =
        formID === "SENSOR-FORM"
          ? selectedSensor
          : formID === "ACTUATOR-FORM"
          ? selectedActuator
          : null;
    }
    this.setState({
      data: selectedData ? selectedData : initSensor,
      thingID: thingIDs[0],
      thingIDs,
      error: null,
    });
  }

  onThingChange(tID) {
    this.setState({ thingID: tID });
  }

  onDataChange(dataPath, value, index = null) {
    this.setState((prevState) => {
      const newData = { ...prevState.data };
      console.log(dataPath, value);
      updateObjectByPath(newData, dataPath, value, index);
      return { data: newData, error: null };
    });
  }

  // handleDelete() {
  //   let deleted = false;
  //   const { thingID, data } = this.state;
  //   const {
  //     tool,
  //     formID,
  //     deleteSimulationSensor,
  //     deleteDGSensor,
  //     deleteDGActuator
  //   } = this.props;
  //   if (formID === "SENSOR-FORM") {
  //     // Add new sensor
  //     if (tool === "simulation") {
  //       // Add sensor to a simulation model
  //       deleteSimulationSensor(data.id, thingID);
  //       this.props.showModal(null);
  //     } else if (tool === "data-generator") {
  //       // add sensor to a data-generator model
  //       deleteDGSensor(data.id);
  //       this.props.showModal(null);
  //     } else {
  //       console.log(`[ERROR] Undefined tool: ${tool}`);
  //       this.setState({ error: `[ERROR] Undefined tool: ${tool}` });
  //     }
  //   } else if (formID === "ACTUATOR-FORM") {
  //     // Add new actuator
  //     if (tool === "data-generator") {
  //       // add actuator to a data-generator model
  //       deleteDGActuator(data.id);
  //       this.props.showModal(null);
  //     } else {
  //       console.log(
  //         `[ERROR] Undefined tool or invalid form: ${tool}, ${formID}`
  //       );
  //       this.setState({
  //         error: `[ERROR] Undefined tool or invalid form: ${tool}, ${formID}`
  //       });
  //     }
  //   } else {
  //     console.log(`[ERROR] Invalid form: ${formID}`);
  //     this.setState({ error: `[ERROR] Invalid form: ${formID}` });
  //   }

  //   if (!deleted) {
  //     this.setState(`Cannot delete thing ${data.id}: Not found!`);
  //   }
  // }

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
    let randomDataForm = null;
    if (
      data.dataSource &&
      data.dataSource.dataDescription &&
      data.dataSource.dataDescription.type
    ) {
      switch (data.dataSource.dataDescription.type) {
        case "Boolean":
          randomDataForm = (
            <FormNumberItem
              label="Init Value"
              min={0}
              max={1}
              defaultValue={data.dataSource.dataDescription.initValue}
              onChange={(v) =>
                this.onDataChange("dataSource.dataDescription.initValue", v)
              }
            />
          );
          break;
        case "Enum":
          randomDataForm = (
            <React.Fragment>
              <FormTextItem
                label="Values"
                defaultValue={JSON.stringify(
                  data.dataSource.dataDescription.values
                )}
                onChange={(v) => {
                  const values = v.split(",");
                  this.onDataChange(
                    "dataSource.dataDescription.values",
                    values
                  );
                  this.setState((prevState) => {
                    const newData = { ...prevState.data };
                    updateObjectByPath(
                      newData,
                      "dataSource.dataDescription.initValue",
                      values[0]
                    );
                    return { data: newData, error: null };
                  });
                }}
              />
              {data.dataSource.dataDescription.values && (
                <FormSelectItem
                  label="Init Value"
                  defaultValue={data.dataSource.dataDescription.initValue}
                  onChange={(v) =>
                    this.onDataChange("dataSource.dataDescription.initValue", v)
                  }
                  options={data.dataSource.dataDescription.values}
                />
              )}
            </React.Fragment>
          );
          break;
        case "Integer":
        case "Double":
          randomDataForm = (
            <FormNumberWithRange
              dataDescription={data.dataSource.dataDescription}
              dataPath="dataSource.dataDescription."
              onChange={(dataPath, v) => this.onDataChange(dataPath, v)}
            />
          );
          break;
        case "Location":
          randomDataForm = (
            <LocationForm
              dataDescription={data.dataSource.dataDescription}
              dataPath="dataSource.dataDescription."
              onChange={(dataPath, v) => this.onDataChange(dataPath, v)}
            />
          );
          break;
        default:
          break;
      }
    }
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
            label="Id"
            defaultValue={data.id}
            onChange={(v) => this.onDataChange("id", v)}
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
            onChange={(v) =>
              {this.onDataChange("isFromDatabase", v === "Replay" ? true : false)}
            }
            options={["Replay", "Generate"]}
          />
          {data.isFromDatabase ? (
            <DataReplayerForm
              dataPath={"dataSource"}
              dataSource = {data.dataSource}
              onDataChange={(dataPath, value) => this.onDataChange(dataPath, value)}
            />
          ) : (
            <DataGeneratorForm
              dataPath={"dataSource"}
              dataSource = {data.dataSource}
              onDataChange={(dataPath, value, index = null) => this.onDataChange(dataPath, value, index)}
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
