import React, { Component } from "react";
import { connect } from "react-redux";
import TSModal from "../TSModal";
import {
  addSimulationSensor,
  addDGSensor,
  addDGActuator,
  showModal
} from "../../actions";
import { Form, Button, Alert } from "antd";
import { updateObjectByPath } from "../../utils";
import {
  FormTextItem,
  FormSelectItem,
  FormNumberItem,
  FormTimeRangeItem
} from "../FormItems";

const DEFAULT_TIME_INTERVAL = 3; // 3 seconds

const initDataDescriptionBoolean = {
  type: "Boolean",
  timeInterval: DEFAULT_TIME_INTERVAL,
  initValue: 1
};

const initDataDescriptionEnum = {
  type: "Enum",
  timeInterval: DEFAULT_TIME_INTERVAL,
  initValue: 1
};

const dataDescriptions = {
  Boolean: initDataDescriptionBoolean,
  Enum: initDataDescriptionEnum,
  Integer: initDataDescriptionEnum,
  Double: initDataDescriptionEnum,
  Location: initDataDescriptionEnum
};

const initDataSourceDatabase = {
  source: "Database",
  dbConfig: {
    host: "localhost",
    port: 27017,
    options: null
  },
  startTime: null,
  endTime: null
};

const initDataSourceRandom = {
  source: "Random",
  dataDescription: initDataDescriptionBoolean
};

const dataSources = {
  Database: initDataSourceDatabase,
  Random: initDataSourceRandom
};

const initSensor = {
  id: `id-${Date.now()}`,
  name: `name-${Date.now()}`,
  dataSource: initDataSourceRandom,
  options: null
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
    let selectedData = formID === 'SENSOR-FORM' ? selectedSensor : (formID === 'ACTUATOR-FORM' ? selectedActuator : null);
    this.state = {
      data: selectedData ? selectedData : initSensor,
      thingID: thingIDs[0],
      thingIDs,
      error: null
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

    let selectedData = formID === 'SENSOR-FORM' ? selectedSensor : (formID === 'ACTUATOR-FORM' ? selectedActuator : null);

    this.setState({
      data: selectedData ? selectedData : initSensor,
      thingID: thingIDs[0],
      thingIDs,
      error: null
    });
  }

  onThingChange(tID) {
    this.setState({ thingID: tID });
  }

  onDataChange(dataPath, value) {
    this.setState(prevState => {
      const newData = { ...prevState.data };
      updateObjectByPath(newData, dataPath, value);
      return { data: newData, error: null };
    });
  }

  handleDelete() {
    let deleted = false;
    const { thingID, data } = this.state;
    const {
      tool,
      formID,
      deleteSimulationSensor,
      deleteDGSensor,
      deleteDGActuator
    } = this.props;
    if (formID === "SENSOR-FORM") {
      // Add new sensor
      if (tool === "simulation") {
        // Add sensor to a simulation model
        deleteSimulationSensor(data.id, thingID);
        this.props.showModal(null);
      } else if (tool === "data-generator") {
        // add sensor to a data-generator model
        deleteDGSensor(data.id);
        this.props.showModal(null);
      } else {
        console.log(`[ERROR] Undefined tool: ${tool}`);
        this.setState({ error: `[ERROR] Undefined tool: ${tool}` });
      }
    } else if (formID === "ACTUATOR-FORM") {
      // Add new actuator
      if (tool === "data-generator") {
        // add actuator to a data-generator model
        deleteDGActuator(data.id);
        this.props.showModal(null);
      } else {
        console.log(
          `[ERROR] Undefined tool or invalid form: ${tool}, ${formID}`
        );
        this.setState({
          error: `[ERROR] Undefined tool or invalid form: ${tool}, ${formID}`
        });
      }
    } else {
      console.log(`[ERROR] Invalid form: ${formID}`);
      this.setState({ error: `[ERROR] Invalid form: ${formID}` });
    }

    if (!deleted) {
      this.setState(`Cannot delete thing ${data.id}: Not found!`);
    }
  }

  handleOk() {
    const { thingID, data } = this.state;
    const {
      tool,
      formID,
      addSimulationSensor,
      addDGSensor,
      addDGActuator
    } = this.props;
    if (formID === "SENSOR-FORM") {
      // Add new sensor
      if (tool === "simulation") {
        // Add sensor to a simulation model
        addSimulationSensor(thingID, data);
        this.props.showModal(null);
      } else if (tool === "data-generator") {
        // add sensor to a data-generator model
        addDGSensor(data);
        this.props.showModal(null);
      } else {
        console.log(`[ERROR] Undefined tool: ${tool}`);
        this.setState({ error: `[ERROR] Undefined tool: ${tool}` });
      }
    } else if (formID === "ACTUATOR-FORM") {
      // Add new actuator
      if (tool === "data-generator") {
        // add actuator to a data-generator model
        addDGActuator(data);
        this.props.showModal(null);
      } else {
        console.log(
          `[ERROR] Undefined tool or invalid form: ${tool}, ${formID}`
        );
        this.setState({
          error: `[ERROR] Undefined tool or invalid form: ${tool}, ${formID}`
        });
      }
    } else {
      console.log(`[ERROR] Invalid form: ${formID}`);
      this.setState({ error: `[ERROR] Invalid form: ${formID}` });
    }
  }

  handleCancel() {
    this.props.showModal(null);
  }

  handleDuplicate() {
    const newThingID = `thing-${Date.now()}`;
    this.setState(prevState => ({
      data: { ...prevState.data, id: newThingID }
    }));
  }

  render() {
    const { data, error, thingID, thingIDs } = this.state;
    const { tool, formID } = this.props;
    let footer = null;
    if (this.props.selectedSensor) {
      footer = [
        <Button key="delete" type="danger" onClick={() => this.handleDelete()}>
          Delete
        </Button>,
        <Button key="duplicate" onClick={() => this.handleDuplicate()}>
          Duplicate
        </Button>,
        <Button key="cancel" onClick={() => this.handleCancel()}>
          Cancel
        </Button>,
        <Button key="ok" type="primary" onClick={() => this.handleOk()}>
          OK
        </Button>
      ];
    } else {
      footer = [
        <Button key="cancel" onClick={() => this.handleCancel()}>
          Cancel
        </Button>,
        <Button key="ok" type="primary" onClick={() => this.handleOk()}>
          OK
        </Button>
      ];
    }
    const isSensor = formID === "SENSOR-FORM" ? true : false;

    return (
      <TSModal
        title={`${isSensor ? "Sensor" : "Actuator"}`}
        visible={
          isSensor ||
          (tool === "data-generator" && !isSensor && formID === "ACTUATOR-FORM")
        }
        onCancel={() => this.handleCancel()}
        footer={footer}
      >
        <Form
          labelCol={{
            span: 4
          }}
          wrapperCol={{
            span: 14
          }}
        >
          {tool === "simulation" && (
            <FormSelectItem
              label="Thing"
              defaultValue={thingID}
              onChange={v => this.onThingChange(v)}
              options={thingIDs}
            />
          )}
          <FormTextItem
            label="Id"
            defaultValue={data.id}
            onChange={v => this.onDataChange("id", v)}
          />
          <FormTextItem
            label="Name"
            defaultValue={data.name}
            onChange={v => this.onDataChange("name", v)}
          />
          <FormTextItem
            label="Topic"
            defaultValue={data.options ? data.options.topic : null}
            onChange={v => this.onDataChange("options", { topic: v })}
          />
          <FormSelectItem
            label="Source"
            defaultValue={data.dataSource.source}
            onChange={v => this.onDataChange("dataSource", dataSources[v])}
            options={["Random", "Database"]}
          />
          <span>Data Source Detail</span>
          <p />
          {data.dataSource.source === "Database" ? (
            <React.Fragment>
              <FormTextItem
                label="Host"
                defaultValue={
                  data.dataSource.dbConfig
                    ? data.dataSource.dbConfig.host
                    : "localhost"
                }
                onChange={v => this.onDataChange("dataSource.dbConfig.host", v)}
              />
              <FormNumberItem
                label="Port"
                min={1023}
                max={65535}
                defaultValue={
                  data.dataSource.dbConfig
                    ? data.dataSource.dbConfig.port
                    : 27017
                }
                onChange={v => this.onDataChange("dataSource.dbConfig.port", v)}
              />
              <FormTextItem
                label="Options"
                defaultValue={
                  data.dataSource.dbConfig
                    ? data.dataSource.dbConfig.options
                    : null
                }
                onChange={v =>
                  this.onDataChange("dataSource.dbConfig.options", v)
                }
              />
              <FormTimeRangeItem
                label="Time"
                onChange={v => {
                  this.onDataChange("dataSource.startTime", v[0]);
                  this.onDataChange("dataSource.endTime", v[1]);
                }}
              />
            </React.Fragment>
          ) : (
            <React.Fragment>
              <FormNumberItem
                label="Time Period"
                min={1}
                max={65535}
                defaultValue={data.dataSource.dataDescription.timeInterval}
                onChange={v =>
                  this.onDataChange(
                    "dataSource.dataDescription.timeInterval",
                    v
                  )
                }
              />
              <FormSelectItem
                label="Type"
                defaultValue={data.dataSource.dataDescription.type}
                onChange={v =>
                  this.onDataChange(
                    "dataSource.dataDescription",
                    dataDescriptions[v]
                  )
                }
                options={["Boolean", "Enum", "Integer", "Double", "Location"]}
              />
            </React.Fragment>
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
  tool
});

const mapDispatchToProps = dispatch => ({
  showModal: modalID => dispatch(showModal(modalID)),
  addSimulationSensor: (thingID, data) =>
    dispatch(addSimulationSensor({ thingID, sensor: data })),
  addDGSensor: data => dispatch(addDGSensor(data)),
  addDGActuator: data => dispatch(addDGActuator(data)),
  deleteSimulationSensor: (id, thingID) =>
    dispatch(deleteSimulationSensor({ thingID, sensorID: id })),
  deleteDGSensor: id => dispatch(deleteDGSensor(id)),
  deleteDGActuator: id => dispatch(deleteDGActuator(id))
});

export default connect(mapPropsToStates, mapDispatchToProps)(SensorModal);
