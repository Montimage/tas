import React, { Component, Fragment } from "react";
import { connect } from "react-redux";
import LayoutPage from "./LayoutPage";
import { getQuery } from "../utils";
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

  componentWillReceiveProps(newProps) {
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
    const { simulationStatus } = this.props;
    if (simulationStatus) {
      // Simulating mode
      const {
        model,
        modelFileName,
        datasetId,
        newDataset,
        logFile,
        report,
      } = simulationStatus;
      return (
        <LayoutPage
          pageTitle="Simulation Page"
          pageSubTitle="Manually perform a simulation"
        >
          <Form labelCol={{ span: 4 }} wrapperCol={{ span: 14 }}>
            {modelFileName ? (
              <FormTextNotEditableItem
                label={"Model File Name"}
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
                <a href={`/data-sets/${newDataset.id}`}>{newDataset.id}</a>
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
                  this.props.stopSimulation();
                }}
                danger
              >
                Stop
              </Button>
              <a href={`/logs/simulations?logFile=${logFile}`}>
                <Button type="link">View Log</Button>
              </a>
              <a href={`/reports/${report.id}`}>
                <Button type="link">View Report</Button>
              </a>
              <a href={`/graphview`}>
                <Button type="link">View Graph</Button>
              </a>
            </Form.Item>
          </Form>
          <p></p>
          <a href={`/logs/simulations`} style={{marginRight: 10}}>View Logs</a> <a href={`/reports`}>View Reports</a>
        </LayoutPage>
      );
    }
    const {
      modelFileName,
      datasetId,
      newDatasetId,
      datasetName,
      datasetDescription,
      datasetTags,
    } = this.state;
    const { allModels, allDatasets } = this.props;
    const datasetOptions = allDatasets.map((ds) => ds.id);
    return (
      <LayoutPage
        pageTitle="Simulation Page"
        pageSubTitle="Manually perform a simulation"
      >
        <Form
          labelCol={{
            span: 4,
          }}
          wrapperCol={{
            span: 14,
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
        <a href={`/logs/simulations`} style={{marginRight: 10}}>View Logs</a> <a href={`/reports`}>View Reports</a>
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
  stopSimulation: () => dispatch(requestStopSimulation()),
});

export default connect(mapPropsToStates, mapDispatchToProps)(SimulationPage);
