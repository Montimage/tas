import React, { Component, Fragment } from "react";
import { connect } from "react-redux";
import { Button, Switch, Form, List, Typography, Divider, Alert } from "antd";
import {
  SwitcherOutlined,
  ExportOutlined,
  CaretRightOutlined,
  CloseSquareOutlined,
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
import JSONView from "../components/JSONView";
import LayoutPage from "./LayoutPage";

import {
  getQuery,
  getLastPath,
  updateObjectByPath,
  deepCloneObject,
} from "../utils";
import {
  FormEditableTextItem,
  FormSelectItem,
  FormTextItem,
  FormTextAreaItem,
} from "../components/FormItems";
import ConnectionConfig from "../components/ConnectionConfig";
import CollapseForm from "../components/CollapseForm";

const { Text } = Typography;

const DataRecorderItem = ({
  data,
  onChange,
  onDelete,
  onDuplicate,
  onEnable,
}) => (
  <CollapseForm
    title={`${data.name}`}
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
      <Divider orientation="left">Source </Divider>
      <FormSelectItem
        label="Protocol"
        defaultValue={data.source.protocol}
        onChange={(v) => onChange("source.protocol", v)}
        options={["MQTT", "MONGODB"]}
      />
      <ConnectionConfig
        defaultValue={data.source.connConfig}
        dataPath={"source.connConfig"}
        onDataChange={onChange}
        type={data.source.protocol}
      />
      <List
        header={<strong>Upstreams ({data.source.upStreams.length})</strong>}
        footer={
          <Button
            onClick={() => {
              const newUpStreams = [
                ...data.source.upStreams,
                `new-up-stream-${Date.now()}`,
              ];
              onChange("source.upStreams", newUpStreams);
            }}
          >
            Add New UpStream
          </Button>
        }
        size="small"
        bordered
        dataSource={data.source.upStreams}
        renderItem={(item, index) => (
          <List.Item
            actions={[
              <Button
                size="small"
                danger
                key="delete"
                onClick={() => {
                  if (data.source.upStreams.length === 1) {
                    onChange("source.upStreams", []);
                  } else {
                    let newUpStreams = [...data.source.upStreams];
                    newUpStreams.splice(index, 1);
                    onChange("source.upStreams", newUpStreams);
                  }
                }}
              >
                Delete
              </Button>,
            ]}
          >
            <Text
              editable={{
                onChange: (v) => onChange(`source.upStreams[${index}]`, v),
              }}
            >
              {item}
            </Text>
          </List.Item>
        )}
      />
      <p></p>
      <List
        header={<strong>Downstreams ({data.source.downStreams.length})</strong>}
        footer={
          <Button
            onClick={() => {
              const newDownStreams = [
                ...data.source.downStreams,
                `new-down-stream-${Date.now()}`,
              ];
              onChange("source.downStreams", newDownStreams);
            }}
          >
            Add New DownStream
          </Button>
        }
        size="small"
        bordered
        dataSource={data.source.downStreams}
        renderItem={(item, index) => (
          <List.Item
            actions={[
              <Button
                size="small"
                danger
                key="delete"
                onClick={() => {
                  if (data.source.downStreams.length === 1) {
                    onChange("source.downStreams", []);
                  } else {
                    let newDownstreams = [...data.source.downStreams];
                    newDownstreams.splice(index, 1);
                    onChange("source.downStreams", newDownstreams);
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
                onChange: (v) => onChange(`source.downStreams[${index}]`, v),
              }}
            >
              {item}
            </Text>
          </List.Item>
        )}
      />
      <Divider orientation="left">Forward </Divider>
      {data.forward ? (
        <Fragment>
          <FormSelectItem
            label="Protocol"
            defaultValue={data.forward.protocol}
            onChange={(v) => onChange("forward.protocol", v)}
            options={["MQTT", "MONGODB"]}
          />
          <ConnectionConfig
            defaultValue={data.forward.connConfig}
            dataPath={"forward.connConfig"}
            onDataChange={onChange}
            type={data.forward.protocol}
          />
          <Button danger onClick={() => onChange("forward", null)}>
            Remove Forward
          </Button>
        </Fragment>
      ) : (
        <Button
          onClick={() =>
            onChange("forward", {
              protocol: "MQTT",
              connConfig: {
                host: "localhost",
                port: 1883,
                options: null,
              },
            })
          }
        >
          Add Forward
        </Button>
      )}
    </Form>
  </CollapseForm>
);

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
    enable: false,
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
      this.onDataChange("dataStorage", dataStorage);
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

    let viewType = getQuery("view");
    if (!viewType) viewType = "form";
    let view = null;
    //TODO: Fix JSON view - do not reload while editting
    if (viewType === "json") {
      view = (
        <JSONView
          value={tempDataRecorder}
          onChange={this.onDataRecorderChange}
        />
      );
    } else {
      view = (
        <Fragment>
          <p></p>
          <FormEditableTextItem
            label="Name"
            defaultValue={tempDataRecorder.name}
            onChange={(newName) => this.onDataChange("name", newName)}
          />
          {tempDataRecorder.dataset && (
            <Form labelCol={{ span: 4 }} wrapperCol={{ span: 14 }}>
              <Divider orientation="left">Data Storage </Divider>
              {tempDataRecorder.dataStorage ? (
                <Fragment>
                  <ConnectionConfig
                    defaultValue={tempDataRecorder.dataStorage.connConfig}
                    dataPath={"dataStorage.connConfig"}
                    onDataChange={(dataPath, value) =>
                      this.onDataChange(dataPath, value)
                    }
                    type={tempDataRecorder.dataStorage.protocol}
                  />
                  <Button danger onClick={() => this.onDataChange('dataStorage', null)}>
                    Remove Custom Data Storage
                  </Button>
                </Fragment>
              ) : (
                <Fragment>
                  <p>Use <a href="/data-storage" target="_blank">Default Data Storage</a></p>
                  <Button onClick={() => this.addCustomDataStorage()}>
                    Add Custom Data Storage
                  </Button>
                </Fragment>
              )}
              <Divider orientation="left">Dataset </Divider>
              <p>Define the Dataset to save the recorded data</p>
              <FormTextItem
                label="Id"
                placeholder="Dataset Id"
                defaultValue={tempDataRecorder.dataset.id}
                onChange={(value) => this.onDataChange("dataset.id", value)}
              />
              <FormTextItem
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
              <FormTextItem
                label="Tags"
                placeholder="Tags"
                defaultValue={JSON.stringify(tempDataRecorder.dataset.tags)}
                onChange={(value) =>
                  this.onDataChange("dataset.tags", JSON.parse(value))
                }
              />
            </Form>
          )}
          <Divider orientation="left">Data Recorders </Divider>
          {tempDataRecorder.dataRecorders ? (
            <Fragment>
              <p>
                Number of recorders: {tempDataRecorder.dataRecorders.length}
              </p>
              <Button onClick={() => this.addNewDataRecorder()}>
                Add New Data Recorder
              </Button>
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
          ) : (
            <Button onClick={() => this.addNewDataRecorder()}>
              Add New Data Recorder
            </Button>
          )}
          <p></p>
        </Fragment>
      );
    }

    return (
      <LayoutPage>
        {dataRecorderStatus && (
          <Alert
            style={{ marginBottom: "15px" }}
            message={
              <div>
                <p>Model: {dataRecorderStatus.model}.</p>
                <p>
                  Started time:{" "}
                  {new Date(
                    dataRecorderStatus.startedTime
                  ).toLocaleTimeString()}
                  .
                </p>
                <p>
                  Log file:{" "}
                  <a
                    href={`/logs/data-recorders?logFile=${dataRecorderStatus.logFile}`}
                  >
                    {dataRecorderStatus.logFile}
                  </a>
                  .
                </p>
                Dataset:{" "}
                <a href={`/data-sets/${tempDataRecorder.dataset.id}`}>
                  {tempDataRecorder.dataset.name}
                </a>
              </div>
            }
            type="success"
          />
        )}
        <a
          href={`${window.location.pathname}?view=${
            viewType === "json" ? "form" : "json"
          }`}
          style={{ marginRight: 10 }}
        >
          <SwitcherOutlined /> Switch View
        </a>
        <Button
          style={{ marginRight: 10 }}
          onClick={() => this.exportModel(tempDataRecorder)}
        >
          <ExportOutlined />
          Export Model
        </Button>
        {dataRecorderStatus && dataRecorderStatus.isRunning ? (
          <Button type="danger" onClick={() => stopDataRecorder()}>
            <CloseSquareOutlined /> Stop
          </Button>
        ) : (
          <Button
            type="primary"
            key="item-start"
            onClick={() => startDataRecorder(dataRecorderFileName)}
            disabled={dataRecorderStatus || isChanged ? true : false}
          >
            <CaretRightOutlined /> Start
          </Button>
        )}
        <p></p>
        {view}
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
          style={{ marginTop: "10px" }}
          disabled={isChanged ? false : true}
        >
          Save
        </Button>
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
  stopDataRecorder: () => dispatch(requestStopDataRecorder()),
});

export default connect(mapPropsToStates, mapDispatchToProps)(DataRecorderPage);
