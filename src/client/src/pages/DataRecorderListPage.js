import React, { Component, Fragment } from "react";
import { connect } from "react-redux";
import { Link } from "react-router-dom";
import { Badge, Button, Dropdown, Popconfirm, Table } from "antd";
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
import { ListStateEmpty, ListStateError } from "../components/ListStates";
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
      requesting,
      requestError,
      fetchAllDataRecorders,
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
          <Link to={`/data-recorders/${model.name}`}>
            {model.name.replace(".json", "")}
          </Link>
        ),
      },
      {
        title: "State",
        key: "state",
        width: 110,
        render: (item) =>
          item.isRunning ? (
            <Badge status="processing" text="Running" />
          ) : (
            <Badge status="default" text="Stopped" />
          ),
      },
      {
        title: "Action",
        key: "action",
        width: 350,
        render: (item) => (
          <Fragment>
            {item.isRunning ? (
              <Popconfirm
                title={`Stop data recorder "${item.name}"?`}
                description="The recorder will stop collecting data."
                okText="Stop"
                cancelText="Cancel"
                onConfirm={() => stopDataRecorder(item.name)}
              >
                <Button
                  style={{ marginRight: 10, paddingRight: 10 }}
                  size="small"
                  type="primary"
                  danger
                >
                  <StopOutlined /> Stop
                </Button>
              </Popconfirm>
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
            <Popconfirm
              title={`Delete data recorder "${item.name}"?`}
              description="This permanently removes the data recorder. It cannot be undone."
              okText="Delete"
              okButtonProps={{ danger: true }}
              cancelText="Cancel"
              onConfirm={() => deleteDataRecorder(item.name)}
            >
              <Button size="small" danger>
                <DeleteOutlined />
                Delete
              </Button>
            </Popconfirm>
          </Fragment>
        ),
      },
    ];

    const emptyState =
      !requesting && requestError ? (
        <ListStateError
          message={requestError.message}
          onRetry={fetchAllDataRecorders}
        />
      ) : (
        <ListStateEmpty
          description="No data recorders yet"
          action={
            <Link to={`/data-recorders/new-DataRecorder-${Date.now()}`}>
              <Button type="primary">Create New Data Recorder</Button>
            </Link>
          }
        />
      );

    return (
      <LayoutPage
        pageTitle="DataRecorder"
        pageSubTitle="DataRecorder will collect data from the target environment and store the data into the DataStorage and also can forward the data into the simulation environment"
      >
        {/* Hidden file input lives outside the antd Menu: v5+ menus take a
            plain `items` array and would not render arbitrary children.
            It is visually hidden but kept in the accessibility tree and tab
            order (`.visually-hidden`, issue #39). */}
        <input
          type="file"
          onChange={(event) => this.onUpload(event.target.files)}
          ref={(input) => {
            this.inputFileDOM = input;
          }}
          className="visually-hidden"
          aria-label="Import data recorder from file"
          accept=".json"
          multiple={false}
        />
        <Dropdown
          menu={{
            items: [
              {
                key: "DataRecorder:3",
                label: (
                  <Link to={`/data-recorders/new-DataRecorder-${Date.now()}`}>
                    <ClearOutlined /> Create New
                  </Link>
                ),
              },
              {
                key: "DataRecorder:1",
                label: (
                  <span>
                    <ImportOutlined /> Import From File
                  </span>
                ),
                onClick: () => this.inputFileDOM.click(),
              },
            ],
          }}
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

        <Table columns={columns} dataSource={dataSource} locale={{ emptyText: emptyState }} />
        <p></p>
        <Link to={`/logs/data-recorders`}>View Logs</Link>
      </LayoutPage>
    );
  }
}

const mapPropsToStates = ({
  allDataRecorders,
  dataRecorderStatus,
  requesting,
  requestError,
}) => ({
  allDataRecorders,
  dataRecorderStatus,
  requesting,
  requestError,
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
