import React, { Component } from "react";
import { connect } from "react-redux";
import TSModal from "../TSModal";
import {
  addSimulationSensor,
  addSimulationActuator,
  showModal,
  selectActuator,
  selectSensor,
} from "../../actions";
import { Form, Button, Alert } from "antd";
import { updateObjectByPath, deepCloneObject, isDataGenerator } from "../../utils";
import { FormTextItem, FormSelectItem, FormSwitchItem, FormEditableTextItem } from "../FormItems";
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
  id: `id-${Date.now()}`,
  objectId: null,
  name: `name-${Date.now()}`,
  enable: true,
  isFromDatabase: false,
  topic: null,
  userData: null,
  dataSource: generateDataSource(),
});

class SensorModal extends Component {
  constructor(props) {
    super(props);

    const { model, selectedSensor, selectedActuator, formID } = props;
    const thingIDs = [null];
    let thingID = null;
    let selectedData =
      formID === "SENSOR-FORM"
        ? selectedSensor
        : formID === "ACTUATOR-FORM"
        ? selectedActuator
        : null;
    if (model.things) {
      const { things } = model;
      for (let index = 0; index < things.length; index++) {
        thingIDs.push(things[index].id);
        if (selectedData !== null && thingID === null) {
          const {sensors, actuators} = things[index];
          if (formID === "SENSOR-FORM" && sensors) {
            for(let sid = 0; sid < sensors.length; sid++) {
              if (sensors[sid].id === selectedData.id) {
                thingID = things[index].id;
                break;
              }
            }
          } else if (formID === "ACTUATOR-FORM" && actuators) {
            for(let aid = 0; aid < actuators.length; aid++) {
              if (actuators[aid].id === selectedData.id) {
                thingID = things[index].id;
                break;
              }
            }
          }
        }
      }
    }
    let replayDS = deepCloneObject(replayDataSource());
    let generateDS = deepCloneObject(generateDataSource());
    let data = initSensor();
    // console.log(data);
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
      thingID: thingIDs[1],
      thingIDs,
      replayDS,
      generateDS,
      error: null,
    };
  }

  componentWillReceiveProps(newProps) {
    const { model, selectedSensor, selectedActuator, formID } = newProps;

    const thingIDs = [null];
    let thingID = null;
    let selectedData =
      formID === "SENSOR-FORM"
        ? selectedSensor
        : formID === "ACTUATOR-FORM"
        ? selectedActuator
        : null;
    if (model.things) {
      const { things } = model;
      for (let index = 0; index < things.length; index++) {
        thingIDs.push(things[index].id);
        if (selectedData !== null && thingID === null) {
          const {sensors, actuators} = things[index];
          if (formID === "SENSOR-FORM" && sensors) {
            for(let sid = 0; sid < sensors.length; sid++) {
              if (sensors[sid].id === selectedData.id) {
                thingID = things[index].id;
                break;
              }
            }
          } else if (formID === "ACTUATOR-FORM" && actuators) {
            for(let aid = 0; aid < actuators.length; aid++) {
              if (actuators[aid].id === selectedData.id) {
                thingID = things[index].id;
                break;
              }
            }
          }
        }
      }
    }
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
      thingID: thingID ? thingID : thingIDs[1],
      thingIDs,
      replayDS,
      generateDS,
      error: null,
      isDG: false,
    });
  }

  componentDidMount() {
    this.setState({isDG: isDataGenerator()});
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
      // console.log(dataPath, value);
      updateObjectByPath(newData, dataPath, value);
      return { data: newData, error: null };
    });
  }

  handleOk() {
    const { thingID, data } = this.state;
    const {
      formID,
      addSimulationSensor,
      addSimulationActuator,
      showModal,
    } = this.props;
    if (formID === "SENSOR-FORM") {
      // Add new sensor
        addSimulationSensor(thingID, data);
        showModal(null);
        this.props.selectSensor(null);
    } else if (formID === "ACTUATOR-FORM") {
      // Add new actuator
        // add actuator to a data-generator model
        addSimulationActuator(thingID, data);
        showModal(null);
        this.props.selectActuator(null);
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
    const { thingID, isDG } = this.state;
    const {
      formID,
      addSimulationSensor,
      addSimulationActuator,
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
        // Add sensor to a simulation model
        addSimulationSensor(thingID, newData);
        selectSensor(newData);
        setTimeout(() => {
          showModal("SENSOR-FORM");
        }, 1000);
        showModal(null);
    } else if (formID === "ACTUATOR-FORM") {
      // Add new actuator
      const newThingID = `act-${Date.now()}`;
      const newData = {
        ...this.state.data,
        id: newThingID,
        name: "New Actuator",
      };
      if (isDG) {
        // add actuator to a data-generator model
        addSimulationActuator(newData);
        setTimeout(() => {
          showModal("ACTUATOR-FORM");
        }, 1000);
        selectActuator(newData);
        showModal(null);
      } else {
        console.log(
          `[ERROR] Undefined tool or invalid form: ${isDG}, ${formID}`
        );
        this.setState({
          error: `[ERROR] Undefined tool or invalid form: ${isDG}, ${formID}`,
        });
      }
    } else {
      console.log(`[ERROR] Invalid form: ${formID}`);
      this.setState({ error: `[ERROR] Invalid form: ${formID}` });
    }
  }

  render() {
    const { data, error, thingID, thingIDs, isDG } = this.state;
    const { formID, selectedActuator, selectedSensor } = this.props;
    if (!isDG && formID === "ACTUATOR-FORM") return null;
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
    const topic = data.topic
      ? data.topic
      : `things/${thingID}/sensors${data.objectId ? `/${data.objectId}` : ""}/${
          data.id
        }`;
    return (
      <TSModal
        title={`${isSensor ? "Sensor" : "Actuator"}`}
        visible={
          isSensor || (isDG && formID === "ACTUATOR-FORM")
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
          <FormSelectItem
            label="Device"
            defaultValue={thingID}
            onChange={(v) => this.onThingChange(v)}
            options={thingIDs}
            helpText={`The identify of the device which the ${isSensor ? 'sensor':'actuator'} will connect to`}
          />
          <FormTextItem
            label="Id"
            defaultValue={data.id}
            onChange={(v) => this.onDataChange("id", v)}
            placeholder="Identify of the device"
            helpText="The identify of the device"
            rules = {[
              {
                required: true,
                message: "Id is required!"
              }
            ]}
          />
          <FormTextItem
            label="Object Id"
            defaultValue={data.objectId}
            onChange={(v) => this.onDataChange("objectId", v)}
            placeholder="Identify of the type of device (IPSO Standard)"
            helpText="The identify of the device type based on IPSO format. For example 3313 - for temperature"
          />
          <FormTextItem
            label="Name"
            defaultValue={data.name}
            onChange={(v) => this.onDataChange("name", v)}
            helpText="The name of the device"
          />
          {!isDG &&
            <FormEditableTextItem
              label="Topic"
              defaultValue={topic}
              onChange={(v) => this.onDataChange("topic", v)}
              helpText="The topic to which the sensor will publish data!"
            />
          }

          <FormTextItem
            label="User Data"
            defaultValue={JSON.stringify(data.userData)}
            onChange={(v) => this.onDataChange("userData", v)}
            placeholder="{}"
            helpText="The user's extra data which the user want to send along with the sensor data. It must be in JSON format"
          />
          <FormSwitchItem
            label="Enable"
            onChange={(v) => this.onDataChange(`enable`, v)}
            checked={data.enable ? true : false}
            checkedChildren={"On"}
            unCheckedChildren={"Off"}
            helpText="Enable or disable this device from the simulation"
          />
          <FormSelectItem
            label="Data Source"
            defaultValue={data.isFromDatabase ? "Replay" : "Generate"}
            onChange={(v) => {
              this.onChangeDataSource(v === "Replay" ? true : false);
            }}
            options={["Replay", "Generate"]}
            helpText="Select the source of the input data for the simulation."
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
              showEnergyOption={
                !isDG && formID === "SENSOR-FORM"
              }
            />
          )}
        </Form>
        {error && <Alert message={error} type="error" />}
      </TSModal>
    );
  }
}

const mapPropsToStates = ({ editingForm, model }) => ({
  formID: editingForm.formID,
  selectedSensor: editingForm.selectedSensor,
  selectedActuator: editingForm.selectedActuator,
  model,
});

const mapDispatchToProps = (dispatch) => ({
  showModal: (modalID) => dispatch(showModal(modalID)),
  addSimulationSensor: (thingID, data) =>
    dispatch(addSimulationSensor({ thingID, sensor: data })),
  addSimulationActuator: (thingID, data) =>
    dispatch(addSimulationActuator({ thingID, actuator: data })),
  selectActuator: (act) => dispatch(selectActuator(act)),
  selectSensor: (sensor) => dispatch(selectSensor(sensor)),
});

export default connect(mapPropsToStates, mapDispatchToProps)(SensorModal);
