import React, { Component, Fragment } from "react";
import { connect } from "react-redux";
import { Button, Dropdown, Popconfirm, Table } from "antd";
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
import { ListStateEmpty, ListStateError } from "../components/ListStates";
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
      requesting,
      requestError,
      fetchAllModels,
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
              <Popconfirm
                title={`Stop the simulation of "${item.name}"?`}
                description="The running simulation will be stopped."
                okText="Stop"
                cancelText="Cancel"
                onConfirm={() => stopSimulation(item.name)}
              >
                <Button
                  style={{ marginRight: 10, paddingRight: 34 }}
                  size="small"
                  type="primary"
                  danger
                >
                  <StopOutlined /> Stop
                </Button>
              </Popconfirm>
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
            <Popconfirm
              title={`Delete topology "${item.name}"?`}
              description="This permanently removes the topology file. It cannot be undone."
              okText="Delete"
              okButtonProps={{ danger: true }}
              cancelText="Cancel"
              onConfirm={() => deleteModel(item.name)}
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
        <ListStateError message={requestError.message} onRetry={fetchAllModels} />
      ) : (
        <ListStateEmpty
          description="No topologies yet"
          action={
            <a href={`/models/new-model-${Date.now()}`}>
              <Button type="primary">Create New Topology</Button>
            </a>
          }
        />
      );

    return (
      <LayoutPage
        pageTitle="Topology"
        pageSubTitle="Defines the topology and the specification of the sensors, actuators and the gateways"
      >
        {/* Hidden file input lives outside the antd Menu: v5+ menus take a
            plain `items` array and would not render arbitrary children. */}
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
        <Dropdown
          menu={{
            items: [
              {
                key: "model:3",
                label: (
                  <a href={`/models/new-model-${Date.now()}`}>
                    <ClearOutlined /> Create New
                  </a>
                ),
              },
              {
                key: "model:1",
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
            Add Model <DownOutlined />
          </Button>
        </Dropdown>
        <Table columns={columns} dataSource={dataSource} locale={{ emptyText: emptyState }} />
      </LayoutPage>
    );
  }
}

const mapPropsToStates = ({ allModels, simulationStatus, requesting, requestError }) => ({
  allModels,
  simulationStatus,
  requesting,
  requestError,
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
