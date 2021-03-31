import React, { Component, Fragment } from "react";
import { connect } from "react-redux";
import {
  Button,
  Form,
  Alert,
  Card,
} from "antd";
import {
  ExportOutlined,
  CaretRightOutlined,
  StopOutlined,
  SaveOutlined,
  PlusCircleOutlined,
  CloseCircleOutlined,
} from "@ant-design/icons";

import {
  requestDataRecorder,
  requestAddNewDataRecorder,
  requestUpdateDataRecorder,
  showModal,
  changeDataRecorderName,
  requestStartDataRecorder,
  requestDataRecorderStatus,
  requestStopDataRecorder,
  requestDataStorage,
} from "../actions";
import LayoutPage from "./LayoutPage";

import {
  getLastPath,
  updateObjectByPath,
  deepCloneObject,
  getObjectId,
} from "../utils";
import {
  FormEditableTextItem,
  FormTextAreaItem,
} from "../components/FormItems";
import DataRecorderItem from '../components/DataRecorderItem';
import ConnectionConfig from "../components/ConnectionConfig";

const newTempDataRecorder = (name) => {
  const currentTime = Date.now();
  return {
    name: name,
    dataRecorders: [],
    dataset: {
      id: `new-data-set-id-${currentTime}`,
      name: `new-data-set-name-${currentTime}`,
      description: `new-data-set-description-${currentTime}`,
      tags: ["generated"],
    },
  };
};

const newDataRecorder = () => {
  const currentTime = Date.now();
  return {
    id: `id-new-data-recorder-${currentTime}`,
    name: `name-new-data-recorder-${currentTime}`,
    enable: true,
    source: {
      protocol: "MQTT",
      connConfig: {
        host: "localhost",
        port: 1883,
        options: null,
      },
      upStreams: [],
      downStreams: [],
    },
  };
};

class DataRecorderPage extends Component {
  constructor(props) {
    super(props);
    let dataRecorderFileName = decodeURI(getLastPath());
    let isNewDataRecorder = dataRecorderFileName.indexOf(".json") === -1;
    this.state = {
      dataRecorderFileName: isNewDataRecorder
        ? `${dataRecorderFileName}.json`
        : dataRecorderFileName,
      tempDataRecorder: isNewDataRecorder
        ? newTempDataRecorder(dataRecorderFileName)
        : {},
      isNewDataRecorder,
      isChanged: false,
    };

    this.onDataRecorderChange = this.onDataRecorderChange.bind(this);
  }

  componentDidMount() {
    let dataRecorderFileName = decodeURI(getLastPath());
    const {
      requestDataRecorder,
      fetchDataRecorderStatus,
      fetchDataStorage,
    } = this.props;
    if (dataRecorderFileName.indexOf(".json") === -1) {
      // This is a new DataRecorder page
      this.setState({
        dataRecorderFileName,
        tempDataRecorder: newTempDataRecorder(dataRecorderFileName),
        isNewDataRecorder: true,
      });
    } else {
      requestDataRecorder(dataRecorderFileName);
      this.setState({ dataRecorderFileName, isNewDataRecorder: false });
      fetchDataRecorderStatus();
    }
    fetchDataStorage();
  }

  componentWillReceiveProps(newProps) {
    const { dataRecorder } = newProps;
    if (dataRecorder) {
      this.setState({
        tempDataRecorder: deepCloneObject(newProps.dataRecorder),
      });
    }
  }

  onDataRecorderChange(newDataRecorder) {
    this.setState({
      tempDataRecorder: newDataRecorder,
      isChanged: true,
    });
  }

  onDataChange(dataPath, value) {
    this.setState((prevState) => {
      const newData = { ...prevState.tempDataRecorder };
      updateObjectByPath(newData, dataPath, value);
      return { tempDataRecorder: newData, error: null, isChanged: true };
    });
  }

  addNewDataRecorder() {
    this.setState((prevState) => ({
      tempDataRecorder: {
        ...prevState.tempDataRecorder,
        dataRecorders: [
          ...prevState.tempDataRecorder.dataRecorders,
          newDataRecorder(),
        ],
      },
      isChanged: true,
    }));
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
      dataRecorderFileName,
      tempDataRecorder,
      isNewDataRecorder,
      isChanged,
    } = this.state;
    const {
      addNewDataRecorder,
      updateDataRecorder,
      startDataRecorder,
      dataRecorderStatus,
      stopDataRecorder,
    } = this.props;
    const recorderId = getObjectId(
      dataRecorderFileName.indexOf(".json")
        ? dataRecorderFileName.replace(".json", "")
        : dataRecorderFileName
    );
    let recorderStatus = null;
    if (dataRecorderStatus && dataRecorderStatus[recorderId]) {
      recorderStatus = dataRecorderStatus[recorderId];
    }
    return (
      <LayoutPage>
        {recorderStatus && (
          <Alert
            style={{ marginBottom: "15px" }}
            message={
              <div>
                <p>Model: {recorderStatus.model}</p>
                <p>
                  Status: {recorderStatus.isRunning ? "Recording" : "Stopped"}
                </p>
                <p>
                  Started time:{" "}
                  {new Date(recorderStatus.startedTime).toLocaleTimeString()}
                </p>
                {recorderStatus.endTime && (
                  <p>
                    End time:{" "}
                    {new Date(recorderStatus.endTime).toLocaleTimeString()}
                  </p>
                )}
                <p>
                  Log file:{" "}
                  <a
                    href={`/logs/data-recorders?logFile=${recorderStatus.logFile}`}
                  >
                    {recorderStatus.logFile}
                  </a>
                </p>
                {tempDataRecorder.dataset && (
                  <Fragment>
                    Dataset:{" "}
                    <a href={`/data-sets/${tempDataRecorder.dataset.id}`}>
                      {tempDataRecorder.dataset.name}
                    </a>
                  </Fragment>
                )}
              </div>
            }
            type={recorderStatus.isRunning ? "success" : "warning"}
          />
        )}
        <Button
          type="primary"
          onClick={() => {
            if (isNewDataRecorder) {
              addNewDataRecorder(tempDataRecorder);
            } else {
              updateDataRecorder(dataRecorderFileName, tempDataRecorder);
            }
            this.setState({ isChanged: false });
          }}
          style={{
            marginRight: 10,
          }}
          disabled={isChanged ? false : true}
        >
          <SaveOutlined /> Save
        </Button>
        <Button
          style={{ marginRight: 10 }}
          onClick={() => this.exportModel(tempDataRecorder)}
        >
          <ExportOutlined />
          Export Model
        </Button>
        {recorderStatus && recorderStatus.isRunning ? (
          <Button
            type="danger"
            onClick={() => stopDataRecorder(dataRecorderFileName)}
          >
            <StopOutlined /> Stop
          </Button>
        ) : (
          <Button
            type="primary"
            key="item-start"
            onClick={() => startDataRecorder(dataRecorderFileName)}
            disabled={
              (recorderStatus && recorderStatus.isRunning) || isChanged
                ? true
                : false
            }
          >
            <CaretRightOutlined /> Start
          </Button>
        )}
        <Card
          title="Overview"
          style={{ marginBottom: 10, marginTop: 10 }}
          size="small"
        >
          <Form labelCol={{ span: 4 }} wrapperCol={{ span: 14 }}>
            <FormEditableTextItem
              label="Name"
              defaultValue={tempDataRecorder.name}
              onChange={(newName) => this.onDataChange("name", newName)}
            />
          </Form>
        </Card>
        {tempDataRecorder.dataset && (
          <Fragment>
            <Card
              title="Setup the connection to the Data Storage"
              style={{ marginBottom: 10 }}
              size="small"
            >
              {tempDataRecorder.dataStorage ? (
                <Fragment>
                  <Form labelCol={{ span: 4 }} wrapperCol={{ span: 14 }}>
                    <ConnectionConfig
                      defaultValue={tempDataRecorder.dataStorage.connConfig}
                      dataPath={"dataStorage.connConfig"}
                      onDataChange={(dataPath, value) =>
                        this.onDataChange(dataPath, value)
                      }
                      type={tempDataRecorder.dataStorage.protocol}
                    />
                  </Form>
                  <Button
                    danger
                    onClick={() => this.onDataChange("dataStorage", null)}
                  >
                    <CloseCircleOutlined /> Remove Custom Data Storage
                  </Button>
                </Fragment>
              ) : (
                <Fragment>
                  <p>
                    The data recorder is using{" "}
                    <a href="/data-storage" target="_blank">
                      the default Data Storage
                    </a>
                  </p>
                  <Button onClick={() => this.addCustomDataStorage()}>
                    <PlusCircleOutlined /> Add Custom Data Storage
                  </Button>
                </Fragment>
              )}
            </Card>
            <Card
              title="Define the new Dataset to store the recorded data"
              style={{ marginBottom: 10 }}
              size="small"
            >
              <Form labelCol={{ span: 4 }} wrapperCol={{ span: 14 }}>
                <FormEditableTextItem
                  label="Id"
                  placeholder="Dataset Id"
                  defaultValue={tempDataRecorder.dataset.id}
                  onChange={(value) => this.onDataChange("dataset.id", value)}
                />
                <FormEditableTextItem
                  label="Name"
                  placeholder="Name"
                  defaultValue={tempDataRecorder.dataset.name}
                  onChange={(value) => this.onDataChange("dataset.name", value)}
                />
                <FormTextAreaItem
                  label="Description"
                  placeholder="Description"
                  defaultValue={tempDataRecorder.dataset.description}
                  onChange={(value) =>
                    this.onDataChange("dataset.description", value)
                  }
                />
                <FormEditableTextItem
                  label="Tags"
                  placeholder="Tags"
                  defaultValue={JSON.stringify(tempDataRecorder.dataset.tags)}
                  onChange={(value) =>
                    this.onDataChange("dataset.tags", JSON.parse(value))
                  }
                />
              </Form>
            </Card>
          </Fragment>
        )}
        <Card
          title={`Recorders (${
            tempDataRecorder.dataRecorders
              ? tempDataRecorder.dataRecorders.length
              : 0
          })`}
          style={{ marginBottom: 10 }}
          size="small"
          extra={
            <Button onClick={() => this.addNewDataRecorder()}>
              <PlusCircleOutlined /> Add New Data Recorder
            </Button>
          }
        >
          {tempDataRecorder.dataRecorders && (
            <Fragment>
              {tempDataRecorder.dataRecorders.map((dr, index) => (
                <DataRecorderItem
                  key={index}
                  data={dr}
                  onChange={(dataPath, value) =>
                    this.onDataChange(
                      `dataRecorders[${index}].${dataPath}`,
                      value
                    )
                  }
                  onEnable={() => {
                    this.onDataChange(
                      `dataRecorders[${index}].enable`,
                      !dr.enable
                    );
                  }}
                  onDelete={() => {
                    let newDataRecorders = [...tempDataRecorder.dataRecorders];
                    newDataRecorders.splice(index, 1);
                    this.onDataChange("dataRecorders", newDataRecorders);
                  }}
                  onDuplicate={() => {
                    let dataRecorder = {
                      ...dr,
                      id: `${dr.id}-duplicated`,
                      name: `${dr.name} [duplicated]`,
                    };
                    let newDataRecorders = [
                      ...tempDataRecorder.dataRecorders,
                      dataRecorder,
                    ];
                    this.onDataChange("dataRecorders", newDataRecorders);
                  }}
                />
              ))}
            </Fragment>
          )}
        </Card>
      </LayoutPage>
    );
  }
}

const mapPropsToStates = ({
  dataRecorder,
  dataRecorderStatus,
  dataStorage,
}) => ({
  dataRecorder,
  dataRecorderStatus,
  dataStorage: dataStorage.connConfig,
});

const mapDispatchToProps = (dispatch) => ({
  fetchDataStorage: () => dispatch(requestDataStorage()),
  requestDataRecorder: (dataRecorderFileName) =>
    dispatch(requestDataRecorder(dataRecorderFileName)),
  fetchDataRecorderStatus: () => dispatch(requestDataRecorderStatus()),
  addNewDataRecorder: (newDataRecorder) =>
    dispatch(requestAddNewDataRecorder(newDataRecorder)),
  updateDataRecorder: (dataRecorderFileName, dataRecorder) =>
    dispatch(requestUpdateDataRecorder({ dataRecorderFileName, dataRecorder })),
  showModal: (formID) => dispatch(showModal(formID)),
  changeDataRecorderName: (newName) =>
    dispatch(changeDataRecorderName(newName)),
  startDataRecorder: (dataRecorderFileName) =>
    dispatch(requestStartDataRecorder(dataRecorderFileName)),
  stopDataRecorder: (fileName) => dispatch(requestStopDataRecorder(fileName)),
});

export default connect(mapPropsToStates, mapDispatchToProps)(DataRecorderPage);
