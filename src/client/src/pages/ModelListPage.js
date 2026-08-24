import React, { Component, Fragment } from "react";
import { connect } from "react-redux";
import { Link } from "react-router-dom";
import { Badge, Button, Dropdown, Popconfirm, Table } from "antd";
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
  setNotification,
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
        // Name the failing import for the user; the raw parse error stays in
        // the console for developers.
        console.error(`Importing "${files[0].name}" failed:`, error);
        this.props.setNotification({
          type: "error",
          message: `Import failed: "${files[0].name}" is not a valid model file (JSON parsing failed). Check the file and try again.`,
        });
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
          <Link to={`/models/${model.name}`}>
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
              <Button
                style={{ marginRight: 10 }}
                size="small"
                type="dashed"
                onClick={() => startSimulation(item.name)}
              >
                <CaretRightOutlined /> Simulate
              </Button>
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
            <Link to={`/models/new-model-${Date.now()}`}>
              <Button type="primary">Create New Topology</Button>
            </Link>
          }
        />
      );

    return (
      <LayoutPage
        pageTitle="Topology"
        pageSubTitle="Defines the topology and the specification of the sensors, actuators and the gateways"
      >
        {/* Hidden file input lives outside the antd Menu: v5+ menus take a
            plain `items` array and would not render arbitrary children.
            It is visually hidden but kept in the accessibility tree and tab
            order (`.visually-hidden`, issue #39) so importing a topology is
            reachable by keyboard and assistive tech directly, not only via
            the programmatic click from the menu item. */}
        <input
          type="file"
          onChange={(event) => this.onUpload(event.target.files)}
          ref={(input) => {
            this.inputFileDOM = input;
          }}
          className="visually-hidden"
          aria-label="Import topology from file"
          accept=".json"
          multiple={false}
        />
        <Dropdown
          menu={{
            items: [
              {
                key: "model:3",
                label: (
                  <Link to={`/models/new-model-${Date.now()}`}>
                    <ClearOutlined /> Create New
                  </Link>
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
  setNotification: (notification) => dispatch(setNotification(notification)),
  startSimulation: (modelFileName) =>
    dispatch(requestStartSimulation({ modelFileName })),
  stopSimulation: (modelFileName) =>
    dispatch(requestStopSimulation(modelFileName)),
});

export default connect(mapPropsToStates, mapDispatchToProps)(ModelListPage);
