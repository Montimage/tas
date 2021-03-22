import React, { Component, Fragment } from "react";
import { connect } from "react-redux";
import { Button, Switch, Form, List, Typography, Divider } from "antd";
// all the edit forms
import SensorModal from "../components/SensorModal";
import ActuatorModal from "../components/ActuatorModal";

import {
  requestModel,
  requestAddNewModel,
  requestUpdateModel,
  showModal,
  selectDevice,
  changeModelName,
  deleteThing,
  changeStatusThing,
  selectSensor,
  deleteSimulationSensor,
  changeStatusSensor,
  selectActuator,
  deleteSimulationActuator,
  changeStatusActuator,
  requestDataStorage, requestSimulationStatus, requestStopSimulation
} from "../actions";
import JSONView from "../components/JSONView";
import LayoutPage from "./LayoutPage";

import {
  SwitcherOutlined,
  ExportOutlined,
  CaretRightOutlined, StopOutlined
} from "@ant-design/icons";
import {
  FormEditableTextItem,
  FormNumberItem,
  FormSelectItem,
  FormSwitchItem,
  FormTextAreaItem,
  FormTimeRangeItem,
} from "../components/FormItems";
import ConnectionConfig from "../components/ConnectionConfig";
import CollapseForm from "../components/CollapseForm";
import {
  getQuery,
  getLastPath,
  updateObjectByPath,
  deepCloneObject,getObjectId
} from "../utils";

const { Text } = Typography;

const addNewDevice = () => {
  const currentTime = Date.now();
  return {
    id: `id-new-device-${currentTime}`,
    name: `name-new-device-${currentTime}`,
    enable: false,
    scale: 1,
    behaviours: [],
    timeToDown: 0,
    testBroker: {
      protocol: "MQTT",
      connConfig: {
        host: "localhost",
        port: 1883,
        options: null,
      },
    },
    productionBroker: null,
    isReplayingStreams: false,
    sensors: [],
    actuators: [],
    upStreams: [],
    downStreams: [],
  };
};

const addNewSensor = () => {
  const currentTime = Date.now();
  return {
    id: `sensor-id-${currentTime}`,
    objectId: null,
    name: `New sensor ${currentTime}`,
    enable: false,
    isFromDatabase: false,
    topic: `sensors/topic/${currentTime}`,
    scale: 1,
    dataSource: "DATA_SOURCE_DATASET",
    replayOptions: null,
    dataSpecs: {
      timePeriod: 5,
      scale: 1,
      dosAttackSpeedUpRate: 5,
      timeBeforeFailed: 20,
      sensorBehaviours: [],
      withEnergy: false,
      isIPSOFormat: false,
      energy: null,
      sources: [],
    },
  };
};

const addNewActuator = () => {
  const currentTime = Date.now();
  return {
    id: `actuator-id-${currentTime}`,
    objectId: null,
    name: `New actuator ${currentTime}`,
    enable: false,
    topic: `actuators/topic/${currentTime}`,
    scale: 1,
  };
};

const ModelDeviceItem = ({
  data,
  onChange,
  onDelete,
  onDuplicate,
  changeModalId,
  selectedModalId,
  onEnable,
}) => (
  <CollapseForm
    title={`${data.name} ${data.scale > 1 ? `(${data.scale} instances)`: ''}`}
    extra={
      <Fragment>
        <Switch
          defaultChecked={data.enable ? true : false}
          checkedChildren="Enable"
          unCheckedChildren="Disable"
          onClick={(value, event) => {
            event.stopPropagation();
            onEnable();
          }}
          style={{ marginRight: 10 }}
        />
        <Button
          onClick={(event) => {
            event.stopPropagation();
            onDuplicate();
          }}
          size="small"
          style={{ marginRight: 10 }}
        >
          Duplicate
        </Button>
        <Button
          onClick={(event) => {
            event.stopPropagation();
            onDelete();
          }}
          size="small"
          danger
        >
          Delete
        </Button>
      </Fragment>
    }
  >
    <Form labelCol={{ span: 4 }} wrapperCol={{ span: 14 }}>
      <FormEditableTextItem
        label="Name"
        defaultValue={data.name}
        onChange={(newName) => onChange("name", newName)}
      />
      <FormEditableTextItem
        label="Id"
        defaultValue={data.id}
        onChange={(newId) => onChange("id", newId)}
      />
      <FormNumberItem
        label="Scale"
        defaultValue={data.scale}
        min={1}
        max={1000}
        onChange={(newScale) => onChange("scale", newScale)}
      />
      <Divider orientation="left">Test Broker </Divider>
      <FormSelectItem
        label="Protocol"
        defaultValue={data.testBroker.protocol}
        onChange={(v) => onChange("testBroker.protocol", v)}
        options={["MQTT", "MQTTS","AZURE_IOT_DEVICE"]}
      />
      <ConnectionConfig
        defaultValue={data.testBroker.connConfig}
        dataPath={"testBroker.connConfig"}
        onDataChange={onChange}
        type={data.testBroker.protocol}
      />
      <Divider orientation="left">Production Broker </Divider>
      {data.productionBroker ? (
        <Fragment>
          <FormSelectItem
            label="Protocol"
            defaultValue={data.productionBroker.protocol}
            onChange={(v) => onChange("productionBroker.protocol", v)}
            options={["MQTT", "MQTTS","AZURE_IOT_DEVICE"]}
          />
          <ConnectionConfig
            defaultValue={data.productionBroker.connConfig}
            dataPath={"productionBroker.connConfig"}
            onDataChange={onChange}
            type={data.productionBroker.protocol}
          />
          <Button danger onClick={() => onChange("productionBroker", null)}>
            Remove Production Broker
          </Button>
        </Fragment>
      ) : (
        <Button
          onClick={() =>
            onChange("productionBroker", {
              protocol: "MQTT",
              connConfig: {
                host: "localhost",
                port: 1883,
                options: null,
              },
            })
          }
        >
          Add Production Broker
        </Button>
      )}

      <FormSwitchItem
        label="Is Replaying Streams"
        checked={data.isReplayingStreams}
        onChange={(v) => onChange("isReplayingStreams", v)}
        checkedChildren="Replaying Streams"
        unCheckedChildren="Sensor simulation"
      />
      {data.isReplayingStreams ? (
        <Fragment>
          <List
            header={<strong>Upstreams ({data.upStreams.length})</strong>}
            footer={
              <Button
                onClick={() => {
                  const newUpStreams = [
                    ...data.upStreams,
                    `new-up-stream-${Date.now()}`,
                  ];
                  onChange("upStreams", newUpStreams);
                }}
              >
                Add New UpStream
              </Button>
            }
            size="small"
            bordered
            dataSource={data.upStreams}
            renderItem={(item, index) => (
              <List.Item
                actions={[
                  <Button
                    size="small"
                    danger
                    key="delete"
                    onClick={() => {
                      if (data.upStreams.length === 1) {
                        onChange("upStreams", []);
                      } else {
                        let newUpStreams = [...data.upStreams];
                        newUpStreams.splice(index, 1);
                        onChange("upStreams", newUpStreams);
                      }
                    }}
                  >
                    Delete
                  </Button>,
                ]}
              >
                <Text
                  editable={{
                    onChange: (v) => onChange(`upStreams[${index}]`, v),
                  }}
                >
                  {item}
                </Text>
              </List.Item>
            )}
          />
          <p></p>
          <List
            header={<strong>Downstreams ({data.downStreams.length})</strong>}
            footer={
              <Button
                onClick={() => {
                  const newDownStreams = [
                    ...data.downStreams,
                    `new-down-stream-${Date.now()}`,
                  ];
                  onChange("downStreams", newDownStreams);
                }}
              >
                Add New DownStream
              </Button>
            }
            size="small"
            bordered
            dataSource={data.downStreams}
            renderItem={(item, index) => (
              <List.Item
                actions={[
                  <Button
                    size="small"
                    danger
                    key="delete"
                    onClick={() => {
                      if (data.downStreams.length === 1) {
                        onChange("downStreams", []);
                      } else {
                        let newDownstreams = [...data.downStreams];
                        newDownstreams.splice(index, 1);
                        onChange("downStreams", newDownstreams);
                      }
                    }}
                  >
                    Delete
                  </Button>,
                ]}
              >
                <Text
                  value={item}
                  editable={{
                    onChange: (v) => onChange(`downStreams[${index}]`, v),
                  }}
                >
                  {item}
                </Text>
              </List.Item>
            )}
          />
        </Fragment>
      ) : (
        <Fragment>
          <Divider orientation="left">Sensors</Divider>
          <List
            header={<strong>Sensors ({data.sensors.reduce(((nbSensor,s) => {
              return s.dataSpecs.scale ? (nbSensor + Number(s.dataSpecs.scale)) : (nbSensor++);
            }), 0)})</strong>}
            footer={
              <Button
                onClick={() => {
                  const newSensor = addNewSensor();
                  if (data.sensors.length === 0) {
                    onChange("sensors", [newSensor]);
                  } else {
                    // const newSensors = [...data.sensors, newSensor];
                    onChange(`sensors[${data.sensors.length}]`, newSensor);
                  }
                }}
              >
                Add New Sensor
              </Button>
            }
            size="small"
            bordered
            dataSource={data.sensors}
            renderItem={(item, index) => (
              <List.Item
                actions={[
                  <Switch
                    checkedChildren="Enable"
                    unCheckedChildren="Disable"
                    defaultChecked={item.enable ? true : false}
                    onChange={() =>
                      onChange(`sensors[${index}].enable`, !item.enable)
                    }
                  />,
                  <Button
                    size="small"
                    key="edit"
                    onClick={() => changeModalId(item.id)}
                  >
                    Edit
                  </Button>,
                  <Button
                    size="small"
                    key="duplicate"
                    onClick={() => {
                      const newSensor = {
                        ...item,
                        id: `${item.id}-duplicated`,
                        name: `${item.name} [duplicaed]`,
                      };
                      let newSensors = [...data.sensors, newSensor];
                      onChange("sensors", newSensors);
                    }}
                  >
                    Duplicate
                  </Button>,
                  <Button
                    size="small"
                    danger
                    key="delete"
                    onClick={() => {
                      if (data.sensors.length === 1) {
                        onChange("sensors", []);
                      } else {
                        let newSensors = [...data.sensors];
                        newSensors.splice(index, 1);
                        onChange("sensors", newSensors);
                      }
                    }}
                  >
                    Delete
                  </Button>,
                ]}
              >
                <Text>{item.name} ({item.dataSpecs.scale ? item.dataSpecs.scale : 1})</Text>
                <SensorModal
                  enable={selectedModalId === item.id}
                  sensorData={item}
                  deviceId={data.id}
                  onOK={(dataPath, value) =>
                    onChange(`sensors[${index}].${dataPath}`, value)
                  }
                  onClose={() => {
                    changeModalId(null);
                  }}
                />
              </List.Item>
            )}
          />
          <p></p>
          <Divider orientation="left">Actuator </Divider>
          <List
            header={<strong>Actuators ({data.actuators.reduce((nbA, a) => a.scale ? (nbA + Number(a.scale)) : nbA++, 0)})</strong>}
            footer={
              <Button
                onClick={() => {
                  const newActuator = addNewActuator();
                  if (data.actuators.length === 0) {
                    onChange("actuators", [newActuator]);
                  } else {
                    // const newActuators = [...data.actuators, newActuator];
                    onChange(
                      `actuators[${data.actuators.length}]`,
                      newActuator
                    );
                  }
                }}
              >
                Add New Actuator
              </Button>
            }
            size="small"
            bordered
            dataSource={data.actuators}
            renderItem={(item, index) => (
              <List.Item
                actions={[
                  <Switch
                    checkedChildren="Enable"
                    unCheckedChildren="Disable"
                    defaultChecked={item.enable ? true : false}
                    onChange={() =>
                      onChange(`actuators[${index}].enable`, !item.enable)
                    }
                  />,
                  <Button
                    size="small"
                    key="edit"
                    onClick={() => changeModalId(item.id)}
                  >
                    Edit
                  </Button>,
                  <Button
                    size="small"
                    key="duplicate"
                    onClick={() => {
                      const newActuator = {
                        ...item,
                        id: `${item.id}-duplicated`,
                        name: `${item.name} [duplicaed]`,
                      };
                      let newActuators = [...data.actuators, newActuator];
                      onChange("actuators", newActuators);
                    }}
                  >
                    Duplicate
                  </Button>,
                  <Button
                    size="small"
                    danger
                    key="delete"
                    onClick={() => {
                      if (data.actuators.length === 1) {
                        onChange("actuators", []);
                      } else {
                        let newActuators = [...data.actuators];
                        newActuators.splice(index, 1);
                        onChange("actuators", newActuators);
                      }
                    }}
                  >
                    Delete
                  </Button>,
                ]}
              >
              <Text>{item.name} ({item.scale ? item.scale : 1})</Text>
                <ActuatorModal
                  enable={selectedModalId === item.id}
                  actuatorData={item}
                  deviceId={data.id}
                  onOK={(dataPath, value) =>
                    onChange(`actuators[${index}].${dataPath}`, value)
                  }
                  onClose={() => {
                    changeModalId(null);
                  }}
                />
              </List.Item>
            )}
          />
        </Fragment>
      )}
    </Form>
  </CollapseForm>
);

class ModelPage extends Component {
  constructor(props) {
    super(props);
    let modelFileName = getLastPath();
    let isNewModel = modelFileName.indexOf(".json") === -1;
    this.state = {
      modelFileName: isNewModel ? `${modelFileName}.json` : modelFileName,
      tempModel: isNewModel
        ? {
            name: modelFileName,
          }
        : {},
      isNewModel,
      selectedModalId: null,
      isChanged: false,
    };

    this.onModelChange = this.onModelChange.bind(this);
  }

  componentDidMount() {
    let modelFileName = getLastPath();
    if (modelFileName.indexOf(".json") === -1) {
      // This is a new model page
      this.setState({
        modelFileName: `${modelFileName}.json`,
        tempModel: {
          name: modelFileName,
        },
        isNewModel: true,
      });
    } else {
      this.props.requestModel(modelFileName);
      this.setState({ modelFileName, isNewModel: false });
    }
    this.props.fetchDataStorage();
    this.props.fetchSimulationStatus();
  }

  componentWillReceiveProps(newProps) {
    this.setState({
      tempModel: deepCloneObject(newProps.model),
    });
  }

  onModelChange(newModel) {
    this.setState({
      tempModel: newModel,
      isChanged: true,
    });
  }

  onDataChange(dataPath, value) {
    this.setState((prevState) => {
      const newData = { ...prevState.tempModel };
      updateObjectByPath(newData, dataPath, value);
      return { tempModel: newData, error: null, isChanged: true };
    });
  }

  exportModel(model) {
    if (model) {
      const fileData = JSON.stringify(model);
      const blob = new Blob([fileData], { type: "text/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.download = `${model.name.replace(/ /g, "")}.json`;
      link.href = url;
      link.click();
    }
  }

  changeModalId(newId) {
    this.setState({ selectedModalId: newId });
  }

  addCustomDataStorage() {
    const { dataStorage } = this.props;
    if (dataStorage) {
      this.onDataChange("dataStorage", deepCloneObject(dataStorage));
    } else {
      this.onDataChange("dataStorage", {
        protocol: "MONGODB",
        connConfig: {
          host: "localhost",
          port: 27017,
          username: null,
          password: null,
          dbname: "my_db_name",
          options: null,
        },
      });
    }
  }

  render() {
    const {
      modelFileName,
      tempModel,
      isNewModel,
      selectedModalId,
      isChanged,
    } = this.state;
    const {simulationStatus, stopSimulation } = this.props;
    let simId = null;
    if (tempModel) {
      if (tempModel.name) {
        simId = getObjectId(tempModel.name);
        // console.log(tempModel.name, simId);
      }
    }
    let isRunning = false;
    if (simulationStatus ) {
      if (simulationStatus[simId]) isRunning = simulationStatus[simId].isRunning;
    }
    // console.log(isRunning);
    const { addNewModel, updateModel } = this.props;

    let viewType = getQuery("view");
    if (!viewType) viewType = "form";
    let view = null;
    let nbDevices = 0;
    if (tempModel.devices) {
      for (let index = 0; index < tempModel.devices.length; index++) {
        nbDevices += tempModel.devices[index].scale ? tempModel.devices[index].scale : 1;
      }
    }
    if (viewType === "json") {
      view = <JSONView value={tempModel} onChange={this.onModelChange} />;
    } else {
      view = (
        <Fragment>
          <p></p>
          <Form labelCol={{ span: 4 }} wrapperCol={{ span: 14 }}>
            <FormEditableTextItem
              label="Name"
              defaultValue={tempModel.name}
              onChange={(newName) => this.onDataChange("name", newName)}
            />
            <Divider orientation="left">Replay Options </Divider>
            <p>The Id of data source</p>
            <FormEditableTextItem
              label="Dataset Id"
              defaultValue={tempModel.datasetId ? tempModel.datasetId : null}
              onChange={(newDatasetId) =>
                this.onDataChange("datasetId", newDatasetId)
              }
            />
            {tempModel.replayOptions ? (
              <CollapseForm title="Replaying Options">
                <FormTimeRangeItem
                  label="Time Range"
                  defaultValue={[
                    tempModel.replayOptions.startTime
                      ? tempModel.replayOptions.startTime
                      : Date.now() - 5 * 60 * 1000,
                    tempModel.replayOptions.endTime
                      ? tempModel.replayOptions.endTime
                      : Date.now(),
                  ]}
                  onChange={(v) => {
                    this.onDataChange(`replayOptions.startTime`, v[0]);
                    this.onDataChange(`replayOptions.endTime`, v[1]);
                  }}
                  helpText="The time range when the data should be replayed."
                />
                <FormNumberItem
                  label="Speedup"
                  min={0.01}
                  max={100}
                  defaultValue={
                    tempModel.replayOptions.speedup
                      ? tempModel.replayOptions.speedup
                      : 1
                  }
                  onChange={(v) =>
                    this.onDataChange(`replayOptions.speedup`, v)
                  }
                  helpText="The replaying speedup (0.01 - 100)!"
                />
                <FormSwitchItem
                  label="Repeat"
                  onChange={(v) => this.onDataChange(`replayOptions.repeat`, v)}
                  checked={tempModel.replayOptions.repeat ? true : false}
                  checkedChildren={"Repeat"}
                  unCheckedChildren={"No Repeat"}
                  helpText="Repeatly replaying the data"
                />
                <Button
                  danger
                  onClick={() => this.onDataChange("replayOptions", null)}
                >
                  Delete Replaying Options
                </Button>
              </CollapseForm>
            ) : (
              <Button
                onClick={() =>
                  this.onDataChange("replayOptions", {
                    startTime: 0,
                    endTime: Date.now(),
                    repeat: false,
                    speedup: 1,
                  })
                }
              >
                Set Replaying Options
              </Button>
            )}
            <Divider orientation="left">Store simulated data</Divider>
            {tempModel.newDataset ? (
              <Fragment>
                <p>New Dataset to save the simulated data</p>
                <FormEditableTextItem
                  label="Id"
                  placeholder="Dataset Id"
                  helpText="The Id of the dataset to be used in the simulation"
                  defaultValue={tempModel.newDataset.id}
                  onChange={(value) =>
                    this.onDataChange("newDataset.id", value)
                  }
                />
                <FormEditableTextItem
                  label="Name"
                  placeholder="Name"
                  defaultValue={tempModel.newDataset.name}
                  onChange={(value) =>
                    this.onDataChange("newDataset.name", value)
                  }
                />
                <FormTextAreaItem
                  label="Description"
                  defaultValue={tempModel.newDataset.description}
                  onChange={(value) =>
                    this.onDataChange("newDataset.description", value)
                  }
                />
                <FormEditableTextItem
                  label="Tags"
                  placeholder="Tags"
                  defaultValue={JSON.stringify(tempModel.newDataset.tags)}
                  onChange={(value) =>
                    this.onDataChange("newDataset.tags", JSON.parse(value))
                  }
                />
                <Button
                  danger
                  onClick={() => this.onDataChange("newDataset", null)}
                >
                  Remove New Dataset
                </Button>
              </Fragment>
            ) : (
              <Button
                onClick={() =>
                  this.onDataChange("newDataset", {
                    id: `new-data-set-${Date.now()}`,
                    name: `New Data Set ${Date.now()}`,
                    description: "Dataset descriptions",
                    tags: ["recorded", "random", "test"],
                  })
                }
              >
                Add New Dataset
              </Button>
            )}
            <Divider orientation="left">Data Storage </Divider>
            {tempModel.dataStorage ? (
              <Fragment>
                <ConnectionConfig
                  defaultValue={tempModel.dataStorage.connConfig}
                  dataPath={"dataStorage.connConfig"}
                  onDataChange={(dataPath, value) =>
                    this.onDataChange(dataPath, value)
                  }
                  type={tempModel.dataStorage.protocol}
                />
                <Button
                  danger
                  onClick={() => this.onDataChange("dataStorage", null)}
                >
                  Remove Custom Data Storage
                </Button>
              </Fragment>
            ) : (
              <Fragment>
                <p>
                  Use{" "}
                  <a href="/data-storage" target="_blank">
                    Default Data Storage
                  </a>
                </p>
                <Button onClick={() => this.addCustomDataStorage()}>
                  Add Custom Data Storage
                </Button>
              </Fragment>
            )}
          </Form>
          <Divider orientation="left">Devices </Divider>
          {tempModel.devices ? (
            <Fragment>
              <p>Number of devices: {nbDevices}</p>
              <Button
                onClick={() => {
                  const newDev = addNewDevice();
                  let newDevices = [...tempModel.devices, newDev];
                  this.onDataChange("devices", newDevices);
                }}
              >
                Add New Device
              </Button>
              {tempModel.devices.map((device, index) => (
                <ModelDeviceItem
                  key={index}
                  data={device}
                  selectedModalId={selectedModalId}
                  changeModalId={(newId) => this.changeModalId(newId)}
                  onEnable={() => {
                    this.onDataChange(
                      `devices[${index}].enable`,
                      !device.enable
                    );
                  }}
                  onChange={(dataPath, value) =>
                    this.onDataChange(`devices[${index}].${dataPath}`, value)
                  }
                  onDelete={() => {
                    let newDevices = [...tempModel.devices];
                    newDevices.splice(index, 1);
                    this.onDataChange("devices", newDevices);
                  }}
                  onDuplicate={() => {
                    let newDevice = {
                      ...device,
                      id: `${device.id}-duplicated`,
                      name: `${device.name} [duplicated]`,
                    };
                    let newDevices = [...tempModel.devices, newDevice];
                    this.onDataChange("devices", newDevices);
                  }}
                />
              ))}
            </Fragment>
          ) : (
            <Button
              onClick={() => {
                const newDev = addNewDevice();
                this.onDataChange("devices", [newDev]);
              }}
            >
              Add New Device
            </Button>
          )}
          <p></p>
        </Fragment>
      );
    }

    return (
      <Fragment>
        <LayoutPage
          pageTitle={window.decodeURI(modelFileName)}
          pageSubTitle="Create/Update a network topology"
        >
          <a
            href={`${window.location.pathname}?view=${
              viewType === "json" ? "form" : "json"
            }`}
            style={{ marginRight: 10 }}
          >
            {" "}
            <SwitcherOutlined /> Switch View
          </a>
          <Button
            onClick={() => this.exportModel(tempModel)}
            style={{ marginRight: 10 }}
          >
            <ExportOutlined />
            Export Model
          </Button>
          {isRunning ? (
            <Button type="primary" danger onClick={() => stopSimulation(modelFileName)}>
              <StopOutlined /> Stop
            </Button>
          ) : (
            <a type="button" href={`/simulation?model=${modelFileName}`}>
              <Button type="primary">
                <CaretRightOutlined /> Simulate
              </Button>
            </a>
          )}
          <p></p>
          {view}
          <Button
            type="primary"
            size="large"
            onClick={() => {
              if (isNewModel) {
                addNewModel(tempModel);
              } else {
                updateModel(modelFileName, tempModel);
              }
              this.setState({ isChanged: false });
            }}
            style={{
              position: "fixed",
              top: 80,
              right: 20,
            }}
            disabled={isChanged ? false : true}
          >
            Save
          </Button>
        </LayoutPage>
      </Fragment>
    );
  }
}

const mapPropsToStates = ({ model, dataStorage, simulationStatus }) => ({
  model,
  dataStorage: dataStorage.connConfig,
  simulationStatus
});

const mapDispatchToProps = (dispatch) => ({
  fetchDataStorage: () => dispatch(requestDataStorage()),
  fetchSimulationStatus: () => dispatch(requestSimulationStatus()),
  requestModel: (modelFileName) => dispatch(requestModel(modelFileName)),
  addNewModel: (newModel) => dispatch(requestAddNewModel(newModel)),
  updateModel: (modelFileName, model) =>
    dispatch(requestUpdateModel({ modelFileName, model })),
  showModal: (formID) => dispatch(showModal(formID)),
  changeModelName: (newName) => dispatch(changeModelName(newName)),
  selectDevice: (device) => dispatch(selectDevice(device)),
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
  stopSimulation: (modelFileName) =>
    dispatch(requestStopSimulation(modelFileName)),
});

export default connect(mapPropsToStates, mapDispatchToProps)(ModelPage);
