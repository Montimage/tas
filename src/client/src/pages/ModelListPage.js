import React, { Component, Fragment } from "react";
import { connect } from "react-redux";
import { Button, Menu, Dropdown, Table } from "antd";
import {
  ClearOutlined,
  ImportOutlined,
  DownOutlined,
  CaretRightOutlined,
  CopyOutlined,
  DeleteOutlined,
  StopOutlined,
} from "@ant-design/icons";
import LayoutPage from "./LayoutPage";
import {
  requestAllModels,
  requestDeleteModel,
  requestDuplicateModel,
  requestAddNewModel,
  requestStartSimulation,
  requestSimulationStatus,
  requestStopSimulation,
} from "../actions";
import { getObjectId } from "../utils";

class ModelListPage extends Component {
  onUpload(files) {
    const fileReader = new FileReader();
    fileReader.onloadend = () => {
      try {
        const newModel = JSON.parse(fileReader.result);
        this.props.importNewModel(newModel);
      } catch (error) {
        this.props.setNotification({ type: "error", message: error });
      }
    };
    fileReader.readAsText(files[0]);
  }

  componentDidMount() {
    this.props.fetchAllModels();
    this.props.fetchSimulationStatus();
  }

  render() {
    const {
      allModels,
      deleteModel,
      duplicateModel,
      simulationStatus,
      startSimulation,
      stopSimulation,
    } = this.props;
    const dataSource = allModels.map((model, index) => {
      const simId = getObjectId(model.replace(".json", ""));
      // console.log(simId);
      let isRunning = false;
      if (simulationStatus) {
        if (simulationStatus[simId])
          isRunning = simulationStatus[simId].isRunning;
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
          <a href={`/models/${model.name}`}>
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
                style={{ marginRight: 10, paddingRight: 34 }}
                size="small"
                type="primary"
                danger
                onClick={() => stopSimulation(item.name)}
              >
                <StopOutlined /> Stop
              </Button>
            ) : (
              <a type="button" href={`/simulation?model=${item.name}`}>
                <Button
                  style={{ marginRight: 10 }}
                  size="small"
                  type="dashed"
                  onClick={() => startSimulation(item.name)}
                >
                  <CaretRightOutlined /> Simulate
                </Button>
              </a>
            )}

            <Button
              style={{ marginRight: 10 }}
              size="small"
              onClick={() => duplicateModel(item.name)}
            >
              <CopyOutlined /> Duplicate
            </Button>
            <Button size="small" onClick={() => deleteModel(item.name)} danger>
              <DeleteOutlined />
              Delete
            </Button>
          </Fragment>
        ),
      },
    ];

    return (
      <LayoutPage
        pageTitle="Topology"
        pageSubTitle="Defines the topology and the specification of the sensors, actuators and the gateways"
      >
        <Dropdown
          overlay={
            <Menu>
              <Menu.Item key="model:3">
                <a href={`/models/new-model-${Date.now()}`}>
                  <ClearOutlined /> Create New
                </a>
              </Menu.Item>
              <Menu.Item
                key="model:1"
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
            Add Model <DownOutlined />
          </Button>
        </Dropdown>
        <Table columns={columns} dataSource={dataSource} />
      </LayoutPage>
    );
  }
}

const mapPropsToStates = ({ allModels, simulationStatus }) => ({
  allModels,
  simulationStatus,
});

const mapDispatchToProps = (dispatch) => ({
  fetchAllModels: () => dispatch(requestAllModels()),
  fetchSimulationStatus: () => dispatch(requestSimulationStatus()),
  deleteModel: (modelFileName) => dispatch(requestDeleteModel(modelFileName)),
  duplicateModel: (modelFileName) =>
    dispatch(requestDuplicateModel(modelFileName)),
  importNewModel: (model) => dispatch(requestAddNewModel(model)),
  startSimulation: (modelFileName) =>
    dispatch(requestStartSimulation({ modelFileName })),
  stopSimulation: (modelFileName) =>
    dispatch(requestStopSimulation(modelFileName)),
});

export default connect(mapPropsToStates, mapDispatchToProps)(ModelListPage);
