import React, { Component, Fragment } from "react";
import { connect } from "react-redux";
import { List, Button, Menu, Dropdown, Table } from "antd";
import {
  ClearOutlined,
  ImportOutlined,
  DownOutlined,
  CopyOutlined,
  DeleteOutlined,
  CaretRightOutlined,
} from "@ant-design/icons";
import LayoutPage from "./LayoutPage";
import {
  requestAllDataRecorders,
  requestDeleteDataRecorder,
  requestDuplicateDataRecorder,
  requestAddNewDataRecorder,
  requestStartDataRecorder,
} from "../actions";

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
  }

  render() {
    const {
      allDataRecorders,
      deleteDataRecorder,
      duplicateDataRecorder,
      startDataRecorder,
    } = this.props;
    const dataSource = allDataRecorders.map((model, index) => ({
      name: model,
      key: index,
    }));
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
            <a type="button" href={`/data-recorders/${item.name}`}>
              <Button
                style={{ marginRight: 10 }}
                size="small"
                type="dashed"
                onClick={() => startDataRecorder(item.name)}
              >
                <CaretRightOutlined /> Launch
              </Button>
            </a>
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

const mapPropsToStates = ({ allDataRecorders }) => ({
  allDataRecorders,
});

const mapDispatchToProps = (dispatch) => ({
  fetchAllDataRecorders: () => dispatch(requestAllDataRecorders()),
  startDataRecorder: (dataRecorderFileName) =>
    dispatch(requestStartDataRecorder(dataRecorderFileName)),
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
