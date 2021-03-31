import React, { Component, Fragment } from "react";
import { connect } from "react-redux";
import { Button, Form, Typography, Card } from "antd";
// all the edit forms
import ModelDeviceItem from "../components/ModelDeviceItem";

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
  requestDataStorage,
  requestSimulationStatus,
  requestStopSimulation,
} from "../actions";
import LayoutPage from "./LayoutPage";

import {
  ExportOutlined,
  StopOutlined,
  PlayCircleOutlined,
  PlusCircleOutlined,
  SettingOutlined,
  CloseCircleOutlined,
  SaveOutlined,
  FileExcelOutlined,
} from "@ant-design/icons";
import {
  FormEditableTextItem,
  FormNumberItem,
  FormSwitchItem,
  FormTextAreaItem,
  FormTimeRangeItem,
} from "../components/FormItems";
import ConnectionConfig from "../components/ConnectionConfig";
import {
  getLastPath,
  updateObjectByPath,
  deepCloneObject,
  getObjectId,
} from "../utils";

const addNewDevice = () => {
  const currentTime = Date.now();
  return {
    id: `id-new-device-${currentTime}`,
    name: `name-new-device-${currentTime}`,
    enable: true,
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
    const { simulationStatus, stopSimulation } = this.props;
    let simId = null;
    if (tempModel) {
      if (tempModel.name) {
        simId = getObjectId(tempModel.name);
        // console.log(tempModel.name, simId);
      }
    }
    let isRunning = false;
    if (simulationStatus) {
      if (simulationStatus[simId])
        isRunning = simulationStatus[simId].isRunning;
    }
    // console.log(isRunning);
    const { addNewModel, updateModel } = this.props;

    let nbDevices = 0;
    if (tempModel.devices) {
      for (let index = 0; index < tempModel.devices.length; index++) {
        nbDevices += tempModel.devices[index].scale
          ? tempModel.devices[index].scale
          : 1;
      }
    }

    return (
      <Fragment>
        <LayoutPage
          pageTitle={window.decodeURI(modelFileName)}
          pageSubTitle="Create/Update a network topology"
        >
          <Button
            type="primary"
            onClick={() => {
              if (isNewModel) {
                addNewModel(tempModel);
              } else {
                updateModel(modelFileName, tempModel);
              }
              this.setState({ isChanged: false });
            }}
            disabled={isChanged ? false : true}
            style={{ marginRight: 10 }}
          >
            <SaveOutlined /> Save
          </Button>
          <Button
            onClick={() => this.exportModel(tempModel)}
            style={{ marginRight: 10 }}
          >
            <ExportOutlined />
            Export Model
          </Button>
          {isRunning ? (
            <Button
              type="primary"
              danger
              onClick={() => stopSimulation(modelFileName)}
            >
              <StopOutlined /> Stop
            </Button>
          ) : (
            <a type="button" href={`/simulation?model=${modelFileName}`}>
              <Button type="primary">
                <PlayCircleOutlined /> Simulate
              </Button>
            </a>
          )}
          <Card
            size="small"
            title="Overview"
            style={{ marginTop: 10, marginBottom: 10 }}
          >
            <Form labelCol={{ span: 4 }} wrapperCol={{ span: 14 }}>
              <FormEditableTextItem
                label="Name"
                defaultValue={tempModel.name}
                onChange={(newName) => this.onDataChange("name", newName)}
              />
            </Form>
          </Card>
          <Card
            size="small"
            title="Data Storage"
            style={{ marginBottom: 10 }}
            extra={
              tempModel.dataStorage ? (
                <Button
                  danger
                  onClick={() => this.onDataChange("dataStorage", null)}
                >
                  <CloseCircleOutlined /> Remove customized configuration
                </Button>
              ) : (
                <Button onClick={() => this.addCustomDataStorage()}>
                  <SettingOutlined /> Add customized configuration
                </Button>
              )
            }
          >
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
              </Fragment>
            ) : (
              <Fragment>
                <p>
                  The model is using
                  <a href="/data-storage" target="_blank">
                    {" "}
                    the default data storage configuration
                  </a>
                </p>
              </Fragment>
            )}
          </Card>
          <Card
            size="small"
            title="Replaying Options"
            style={{ marginBottom: 10 }}
            extra={
              tempModel.replayOptions ? (
                <Button
                  danger
                  onClick={() => this.onDataChange("replayOptions", null)}
                >
                  <CloseCircleOutlined /> Delete Replaying Options
                </Button>
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
                  <SettingOutlined /> Set Replaying Options
                </Button>
              )
            }
          >
            <Form labelCol={{ span: 4 }} wrapperCol={{ span: 14 }}>
              <FormEditableTextItem
                label="Replaying Dataset Id"
                defaultValue={tempModel.datasetId ? tempModel.datasetId : null}
                onChange={(newDatasetId) =>
                  this.onDataChange("datasetId", newDatasetId)
                }
              />
              {tempModel.replayOptions && (
                <Fragment>
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
                    onChange={(v) =>
                      this.onDataChange(`replayOptions.repeat`, v)
                    }
                    checked={tempModel.replayOptions.repeat ? true : false}
                    checkedChildren={"Repeat"}
                    unCheckedChildren={"No Repeat"}
                    helpText="Repeatly replaying the data"
                  />
                </Fragment>
              )}
            </Form>
          </Card>
          <Card
            size="small"
            title="Setup a New Dataset to save the simulated data"
            style={{ marginBottom: 10 }}
            extra={
              tempModel.newDataset ? (
                <Button
                  danger
                  onClick={() => this.onDataChange("newDataset", null)}
                >
                  <CloseCircleOutlined /> Remove New Dataset
                </Button>
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
                  <PlusCircleOutlined /> Add New Dataset
                </Button>
              )
            }
          >
            {tempModel.newDataset && (
              <Form labelCol={{ span: 4 }} wrapperCol={{ span: 14 }}>
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
              </Form>
            )}
          </Card>
          <Card
            size="small"
            title="Device list"
            style={{ marginBottom: 10 }}
            extra={
              <Button
                onClick={() => {
                  const newDev = addNewDevice();
                  let newDevices = [newDev];
                  if (tempModel.devices) {
                    newDevices = [...tempModel.devices, newDev];
                  }
                  this.onDataChange("devices", newDevices);
                }}
              >
                <PlusCircleOutlined /> Add New Device
              </Button>
            }
          >
            {tempModel.devices && (
              <Fragment>
                <p>Number of devices: {nbDevices}</p>
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
            )}
          </Card>
          <a href={`/reports/?topologyFileName=${tempModel.name}.json`}>
          <Button>
            {" "}
            <FileExcelOutlined /> View All Reports
          </Button>
        </a>
        </LayoutPage>
      </Fragment>
    );
  }
}

const mapPropsToStates = ({ model, dataStorage, simulationStatus }) => ({
  model,
  dataStorage: dataStorage.connConfig,
  simulationStatus,
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
