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
import {
  updateObjectByPath,
  deepCloneObject,
  isDataGenerator,
} from "../../utils";
import {
  FormTextItem,
  FormSelectItem,
  FormSwitchItem,
  FormEditableTextItem,
} from "../FormItems";
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

const generateDataSpecs = () => ({
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
  dataSpecs: generateDataSpecs(),
});

class SensorModal extends Component {
  constructor(props) {
    super(props);

    const { model, selectedSensor, selectedActuator, formID } = props;
    const deviceIDs = [null];
    let deviceID = null;
    let selectedData =
      formID === "SENSOR-FORM"
        ? selectedSensor
        : formID === "ACTUATOR-FORM"
        ? selectedActuator
        : null;
    if (model.devices) {
      const { devices } = model;
      for (let index = 0; index < devices.length; index++) {
        deviceIDs.push(devices[index].id);
        if (selectedData !== null && deviceID === null) {
          const { sensors, actuators } = devices[index];
          if (formID === "SENSOR-FORM" && sensors) {
            for (let sid = 0; sid < sensors.length; sid++) {
              if (sensors[sid].id === selectedData.id) {
                deviceID = devices[index].id;
                break;
              }
            }
          } else if (formID === "ACTUATOR-FORM" && actuators) {
            for (let aid = 0; aid < actuators.length; aid++) {
              if (actuators[aid].id === selectedData.id) {
                deviceID = devices[index].id;
                break;
              }
            }
          }
        }
      }
    }
    let replayDS = deepCloneObject(replayDataSource());
    let generateDS = deepCloneObject(generateDataSpecs());
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
      deviceID: deviceIDs[1],
      deviceIDs,
      replayDS,
      generateDS,
      error: null,
    };
  }

  componentWillReceiveProps(newProps) {
    const { model, selectedSensor, selectedActuator, formID } = newProps;

    const deviceIDs = [null];
    let deviceID = null;
    let selectedData =
      formID === "SENSOR-FORM"
        ? selectedSensor
        : formID === "ACTUATOR-FORM"
        ? selectedActuator
        : null;
    if (model.devices) {
      const { devices } = model;
      for (let index = 0; index < devices.length; index++) {
        deviceIDs.push(devices[index].id);
        if (selectedData !== null && deviceID === null) {
          const { sensors, actuators } = devices[index];
          if (formID === "SENSOR-FORM" && sensors) {
            for (let sid = 0; sid < sensors.length; sid++) {
              if (sensors[sid].id === selectedData.id) {
                deviceID = devices[index].id;
                break;
              }
            }
          } else if (formID === "ACTUATOR-FORM" && actuators) {
            for (let aid = 0; aid < actuators.length; aid++) {
              if (actuators[aid].id === selectedData.id) {
                deviceID = devices[index].id;
                break;
              }
            }
          }
        }
      }
    }
    let replayDS = deepCloneObject(replayDataSource());
    let generateDS = deepCloneObject(generateDataSpecs());
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
      deviceID: deviceID ? deviceID : deviceIDs[1],
      deviceIDs,
      replayDS,
      generateDS,
      error: null,
      isDG: false,
    });
  }

  componentDidMount() {
    this.setState({ isDG: isDataGenerator() });
  }

  onThingChange(tID) {
    this.setState({ deviceID: tID });
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
    const { deviceID, data } = this.state;
    const {
      formID,
      addSimulationSensor,
      addSimulationActuator,
      showModal,
    } = this.props;
    if (formID === "SENSOR-FORM") {
      // Add new sensor
      addSimulationSensor(deviceID, data);
      showModal(null);
      this.props.selectSensor(null);
    } else if (formID === "ACTUATOR-FORM") {
      // Add new actuator
      // add actuator to a data-generator model
      addSimulationActuator(deviceID, data);
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

  // handleDuplicate() {
  //   const { deviceID, isDG } = this.state;
  //   const {
  //     formID,
  //     addSimulationSensor,
  //     addSimulationActuator,
  //     showModal,
  //     selectSensor,
  //     selectActuator,
  //   } = this.props;

  //   if (formID === "SENSOR-FORM") {
  //     const newdeviceID = `sensor-${Date.now()}`;
  //     const newData = {
  //       ...this.state.data,
  //       id: newdeviceID,
  //       name: "New Sensor",
  //     };
  //     // Add new sensor
  //     // Add sensor to a simulation model
  //     addSimulationSensor(deviceID, newData);
  //     selectSensor(newData);
  //     setTimeout(() => {
  //       showModal("SENSOR-FORM");
  //     }, 1000);
  //     showModal(null);
  //   } else if (formID === "ACTUATOR-FORM") {
  //     // Add new actuator
  //     const newdeviceID = `act-${Date.now()}`;
  //     const newData = {
  //       ...this.state.data,
  //       id: newdeviceID,
  //       name: "New Actuator",
  //     };
  //     if (isDG) {
  //       // add actuator to a data-generator model
  //       addSimulationActuator(newData);
  //       setTimeout(() => {
  //         showModal("ACTUATOR-FORM");
  //       }, 1000);
  //       selectActuator(newData);
  //       showModal(null);
  //     } else {
  //       console.log(
  //         `[ERROR] Undefined tool or invalid form: ${isDG}, ${formID}`
  //       );
  //       this.setState({
  //         error: `[ERROR] Undefined tool or invalid form: ${isDG}, ${formID}`,
  //       });
  //     }
  //   } else {
  //     console.log(`[ERROR] Invalid form: ${formID}`);
  //     this.setState({ error: `[ERROR] Invalid form: ${formID}` });
  //   }
  // }

  render() {
    const { data, error, deviceID, deviceIDs, isDG } = this.state;
    const { formID, selectedActuator, selectedSensor } = this.props;
    if (!isDG && formID === "ACTUATOR-FORM") return null;
    let footer = null;
    if (
      (selectedSensor && formID === "SENSOR-FORM") ||
      (selectedActuator && formID === "ACTUATOR-FORM")
    ) {
      footer = [
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
      : `devices/${deviceID}/sensors${data.objectId ? `/${data.objectId}` : ""}/${
          data.id
        }`;
    return (
      <TSModal
        title={`${isSensor ? "Sensor" : "Actuator"}`}
        visible={isSensor || (isDG && formID === "ACTUATOR-FORM")}
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
            defaultValue={deviceID}
            onChange={(v) => this.onThingChange(v)}
            options={deviceIDs}
            helpText={`The identify of the device which the ${
              isSensor ? "sensor" : "actuator"
            } will connect to`}
          />
          <FormTextItem
            label="Id"
            defaultValue={data.id}
            onChange={(v) => this.onDataChange("id", v)}
            placeholder="Identify of the device"
            helpText="The identify of the device"
            rules={[
              {
                required: true,
                message: "Id is required!",
              },
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
          {!isDG && (
            <FormEditableTextItem
              label="Topic"
              defaultValue={topic}
              onChange={(v) => this.onDataChange("topic", v)}
              helpText="The topic to which the sensor will publish data!"
            />
          )}

          <FormSwitchItem
            label="Enable"
            onChange={(v) => this.onDataChange(`enable`, v)}
            checked={data.enable ? true : false}
            checkedChildren={"On"}
            unCheckedChildren={"Off"}
            helpText="Enable or disable this device from the simulation"
          />
          <DataGeneratorForm
            dataPath={"dataSpecs"}
            dataSpecs={data.dataSpecs}
            onDataChange={(dataPath, value) =>
              this.onDataChange(dataPath, value)
            }
          />
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
  addSimulationSensor: (deviceID, data) =>
    dispatch(addSimulationSensor({ deviceID, sensor: data })),
  addSimulationActuator: (deviceID, data) =>
    dispatch(addSimulationActuator({ deviceID, actuator: data })),
  selectActuator: (act) => dispatch(selectActuator(act)),
  selectSensor: (sensor) => dispatch(selectSensor(sensor)),
});

export default connect(mapPropsToStates, mapDispatchToProps)(SensorModal);
