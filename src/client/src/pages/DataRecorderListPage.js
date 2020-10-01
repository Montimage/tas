import React, { Component, Fragment } from "react";
import { connect } from "react-redux";
import { Button, Menu, Dropdown, Table } from "antd";
import {
  ClearOutlined,
  ImportOutlined,
  DownOutlined,
  CopyOutlined,
  DeleteOutlined,
  CaretRightOutlined,
  StopOutlined,
} from "@ant-design/icons";
import LayoutPage from "./LayoutPage";
import {
  requestAllDataRecorders,
  requestDeleteDataRecorder,
  requestDuplicateDataRecorder,
  requestAddNewDataRecorder,
  requestStartDataRecorder,
  requestDataRecorderStatus,
  requestStopDataRecorder,
} from "../actions";
import { getObjectId } from "../utils";

class DataRecorderListPage extends Component {
  onUpload(files) {
    const fileReader = new FileReader();
    fileReader.onloadend = () => {
      try {
        const newDataRecorder = JSON.parse(fileReader.result);
        this.props.importNewDataRecorder(newDataRecorder);
      } catch (error) {
        this.props.setNotification({ type: "error", message: error });
      }
    };
    fileReader.readAsText(files[0]);
  }

  componentDidMount() {
    this.props.fetchAllDataRecorders();
    this.props.fetchDataRecorderStatus();
  }

  render() {
    const {
      allDataRecorders,
      deleteDataRecorder,
      duplicateDataRecorder,
      startDataRecorder,
      dataRecorderStatus,
      stopDataRecorder,
    } = this.props;
    const dataSource = allDataRecorders.map((model, index) => {
      let recorderId = null;
      if (model) {
        recorderId = getObjectId(model.replace(".json", ""));
      }
      let isRunning = false;
      if (dataRecorderStatus) {
        if (dataRecorderStatus[recorderId]) {
          if (dataRecorderStatus[recorderId].isRunning) isRunning = true;
        }
      }
      return {
        name: model,
        key: index,
        isRunning,
      };
    });
    const columns = [
      {
        title: "Name",
        key: "data",
        render: (model) => (
          <a href={`/data-recorders/${model.name}`}>
            {model.name.replace(".json", "")}
          </a>
        ),
      },
      {
        title: "Action",
        key: "action",
        width: 350,
        render: (item) => (
          <Fragment>
            {item.isRunning ? (
              <Button
                style={{ marginRight: 10, paddingRight: 10 }}
                size="small"
                type="primary"
                danger
                onClick={() => stopDataRecorder(item.name)}
              >
                <StopOutlined /> Stop
              </Button>
            ) : (
              <Button
                style={{ marginRight: 10 }}
                size="small"
                type="dashed"
                onClick={() => startDataRecorder(item.name)}
              >
                <CaretRightOutlined /> Start
              </Button>
            )}
            <Button
              style={{ marginRight: 10 }}
              size="small"
              onClick={() => duplicateDataRecorder(item.name)}
            >
              <CopyOutlined /> Duplicate
            </Button>
            <Button
              size="small"
              onClick={() => deleteDataRecorder(item.name)}
              danger
            >
              <DeleteOutlined />
              Delete
            </Button>
          </Fragment>
        ),
      },
    ];

    return (
      <LayoutPage
        pageTitle="DataRecorder"
        pageSubTitle="DataRecorder will collect data from the target environment and store the data into the DataStorage and also can forward the data into the simulation environment"
      >
        <Dropdown
          overlay={
            <Menu>
              <Menu.Item key="DataRecorder:3">
                <a href={`/data-recorders/new-DataRecorder-${Date.now()}`}>
                  <ClearOutlined /> Create New
                </a>
              </Menu.Item>
              <Menu.Item
                key="DataRecorder:1"
                onClick={() => this.inputFileDOM.click()}
              >
                <ImportOutlined /> Import From File
                <input
                  type="file"
                  onChange={(event) => this.onUpload(event.target.files)}
                  ref={(input) => {
                    this.inputFileDOM = input;
                  }}
                  style={{ display: "none" }}
                  accept=".json"
                  multiple={false}
                />
              </Menu.Item>
            </Menu>
          }
          trigger={["click"]}
        >
          <Button
            className="ant-dropdown-link"
            onClick={(e) => e.preventDefault()}
            style={{ marginBottom: "15px" }}
          >
            Add DataRecorder <DownOutlined />
          </Button>
        </Dropdown>

        <Table columns={columns} dataSource={dataSource} />
        <p></p>
        <a href={`/logs/data-recorders`}>View Logs</a>
      </LayoutPage>
    );
  }
}

const mapPropsToStates = ({ allDataRecorders, dataRecorderStatus }) => ({
  allDataRecorders,
  dataRecorderStatus,
});

const mapDispatchToProps = (dispatch) => ({
  fetchAllDataRecorders: () => dispatch(requestAllDataRecorders()),
  fetchDataRecorderStatus: () => dispatch(requestDataRecorderStatus()),
  startDataRecorder: (dataRecorderFileName) =>
    dispatch(requestStartDataRecorder(dataRecorderFileName)),
  stopDataRecorder: (dataRecorderFileName) =>
    dispatch(requestStopDataRecorder(dataRecorderFileName)),
  deleteDataRecorder: (dataRecorderFileName) =>
    dispatch(requestDeleteDataRecorder(dataRecorderFileName)),

  duplicateDataRecorder: (dataRecorderFileName) =>
    dispatch(requestDuplicateDataRecorder(dataRecorderFileName)),
  importNewDataRecorder: (dataRecorder) =>
    dispatch(requestAddNewDataRecorder(dataRecorder)),
});

export default connect(
  mapPropsToStates,
  mapDispatchToProps
)(DataRecorderListPage);
