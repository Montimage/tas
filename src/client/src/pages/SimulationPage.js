import React, { Component } from "react";
import { connect } from "react-redux";
import { Link } from "react-router-dom";
import LayoutPage from "./LayoutPage";
import { getObjectId, getQuery } from "../utils";
import {
  FormSelectItem,
  FormEditableTextItem,
  FormTextNotEditableItem,
  FormTextAreaItem,
} from "../components/FormItems";
import {
  requestAllModels,
  requestAllDatasets,
  requestStartSimulation,
  requestStopSimulation,
  requestSimulationStatus,
} from "../actions";
import { Form, Button } from "antd";
const NONE_DATA_SET_OPTION = "No Data Source";
class SimulationPage extends Component {
  constructor(props) {
    super(props);
    const currentTime = Date.now();
    this.state = {
      modelFileName: null,
      datasetId: NONE_DATA_SET_OPTION,
      newDatasetId: `dataset-id-${currentTime}`,
      datasetName: `Dataset has been created at ${currentTime}`,
      datasetDescription: `This is the description of the dataset created at ${currentTime}`,
      datasetTags: ["generated"],
    };
  }

  componentDidMount() {
    const dsId = getQuery("datasetId");
    this.setState({
      modelFileName: getQuery("model"),
      datasetId: dsId ? dsId : NONE_DATA_SET_OPTION,
    });
    this.props.fetchModelFiles();
    this.props.fetchDatasets();
    this.props.fetchSimulationStatus();
    setInterval(() => {
      this.props.fetchSimulationStatus();
    }, 3000);
  }

  UNSAFE_componentWillReceiveProps(newProps) {
    if (!this.state.modelFileName && newProps.allModels) {
      this.setState({ modelFileName: newProps.allModels[0] });
    }
  }

  onModelFileNameChange(newModel) {
    this.setState({ modelFileName: newModel });
  }

  onDatasetIdChange(newDS) {
    this.setState({ datasetId: newDS });
  }

  onNewDatasetIdChange(newDS) {
    this.setState({ newDatasetId: newDS });
  }

  onDatasetNameChange(name) {
    this.setState({ datasetName: name });
  }

  onDatasetDescriptionChange(desc) {
    this.setState({ datasetDescription: desc });
  }

  onDatasetTagsChange(tags) {
    this.setState({ datasetTags: tags.split(",") });
  }

  render() {
    const { modelFileName } = this.state;
    const {
      datasetId,
      newDatasetId,
      datasetName,
      datasetDescription,
      datasetTags,
    } = this.state;
    const { allModels, allDatasets } = this.props;

    if (modelFileName) {
      const simId = getObjectId(modelFileName.replace(".json", ""));
      const { simulationStatus } = this.props;
      if (simulationStatus[simId] && simulationStatus[simId].isRunning) {
        // Simulating mode
        const {
          model,
          modelFileName,
          datasetId,
          newDataset,
          logFile,
          report,
        } = simulationStatus[simId];
        return (
          <LayoutPage
            pageTitle="Simulation Page"
            pageSubTitle="Manually perform a simulation"
          >
            <Form labelCol={{ xs: { span: 24 }, sm: { span: 4 } }} wrapperCol={{ xs: { span: 24 }, sm: { span: 14 } }}>
              <FormSelectItem
                label={"Model File Name"}
                defaultValue={modelFileName}
                options={allModels}
                onChange={(value) => this.onModelFileNameChange(value)}
              />
              {modelFileName ? (
                <FormTextNotEditableItem
                  label={"Model"}
                  value={
                    <a href={`/api/models/${modelFileName}`}>{modelFileName}</a>
                  }
                />
              ) : (
                <FormTextNotEditableItem label={"Model"} value={model.name} />
              )}

              {datasetId && (
                <FormTextNotEditableItem
                  label={"Dataset Source"}
                  helpText="The source of the data input for the simulation"
                  value={datasetId}
                />
              )}
              <p>The data generated are stored in the dataset</p>
              <FormTextNotEditableItem
                label="Dataset Id"
                value={
                  <Link to={`/data-sets/${newDataset.id}`}>{newDataset.id}</Link>
                }
              />
              <Form.Item
                wrapperCol={{
                  xs: {
                    span: 24,
                    offset: 0,
                  },
                  sm: {
                    span: 16,
                    offset: 4,
                  },
                }}
              >
                <Button
                  type="primary"
                  onClick={() => {
                    this.props.stopSimulation(modelFileName);
                  }}
                  danger
                >
                  Stop
                </Button>
                <Link to={`/logs/simulations?logFile=${logFile}`}>
                  <Button type="link">View Log</Button>
                </Link>
                <Link to={`/reports/${report.id}`}>
                  <Button type="link">View Report</Button>
                </Link>
                <Link to={`/graphview`}>
                  <Button type="link">View Graph</Button>
                </Link>
              </Form.Item>
            </Form>
            <p></p>
            <Link to={`/logs/simulations`} style={{ marginRight: 10 }}>
              View Logs
            </Link>{" "}
            <Link to={`/reports`}>View Reports</Link>
          </LayoutPage>
        );
      }
    }
    const datasetOptions = allDatasets.map((ds) => ds.id);
    return (
      <LayoutPage
        pageTitle="Simulation Page"
        pageSubTitle="Manually perform a simulation"
      >
        <Form
          labelCol={{
            xs: { span: 24 },
            sm: { span: 4 },
          }}
          wrapperCol={{
            xs: { span: 24 },
            sm: { span: 14 },
          }}
        >
          <FormSelectItem
            label={"Model File Name"}
            defaultValue={modelFileName}
            options={allModels}
            onChange={(value) => this.onModelFileNameChange(value)}
          />
          <FormSelectItem
            label={"Data Source"}
            defaultValue={datasetId}
            options={[...datasetOptions, NONE_DATA_SET_OPTION]}
            onChange={(value) => this.onDatasetIdChange(value)}
          />
          <p>Store the generated data to a new dataset</p>
          <FormEditableTextItem
            label="Id"
            placeholder="New Dataset Id"
            defaultValue={newDatasetId}
            onChange={(value) => this.onNewDatasetIdChange(value)}
          />
          <FormEditableTextItem
            label="Name"
            placeholder="Name"
            defaultValue={datasetName}
            onChange={(value) => this.onDatasetNameChange(value)}
          />
          <FormTextAreaItem
            label="Description"
            defaultValue={datasetDescription}
            onChange={(value) => this.onDatasetDescriptionChange(value)}
          />
          <FormEditableTextItem
            label="Tags"
            placeholder="Tags"
            defaultValue={JSON.stringify(datasetTags)}
            onChange={(value) => this.onDatasetTagsChange(JSON.parse(value))}
          />
          <Form.Item
            wrapperCol={{
              xs: {
                span: 24,
                offset: 0,
              },
              sm: {
                span: 16,
                offset: 4,
              },
            }}
          >
            <Button
              type="primary"
              onClick={() => {
                this.props.startSimulation(
                  modelFileName,
                  datasetId === NONE_DATA_SET_OPTION ? null : datasetId,
                  {
                    id: newDatasetId,
                    name: datasetName,
                    description: datasetDescription,
                    tags: datasetTags,
                    source: "GENERATED",
                  }
                );
              }}
            >
              Start
            </Button>
          </Form.Item>
        </Form>
        <p></p>
        <Link to={`/logs/simulations`} style={{ marginRight: 10 }}>
          View Logs
        </Link>{" "}
        <Link to={`/reports`}>View Reports</Link>
      </LayoutPage>
    );
  }
}

const mapPropsToStates = ({ allModels, datasets, simulationStatus }) => ({
  allModels,
  allDatasets: datasets.allDatasets,
  simulationStatus,
});

const mapDispatchToProps = (dispatch) => ({
  fetchModelFiles: () => dispatch(requestAllModels()),
  fetchDatasets: () => dispatch(requestAllDatasets()),
  fetchSimulationStatus: () => dispatch(requestSimulationStatus()),
  startSimulation: (modelFileName, datasetId, newDataset) =>
    dispatch(
      requestStartSimulation({
        modelFileName,
        datasetId,
        newDataset,
      })
    ),
  stopSimulation: (modelFileName) =>
    dispatch(requestStopSimulation(modelFileName)),
});

export default connect(mapPropsToStates, mapDispatchToProps)(SimulationPage);
