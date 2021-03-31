import React, { Component } from "react";
import { connect } from "react-redux";
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
import { Form, Button, Card } from "antd";
import {
  FileExcelOutlined,
  FileTextOutlined,
  PlayCircleOutlined,
  StopOutlined,
} from "@ant-design/icons";
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
            <Card style={{ marginBottom: 10 }}>
              <Form labelCol={{ span: 4 }} wrapperCol={{ span: 14 }}>
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
                      <a href={`/api/models/${modelFileName}`}>
                        {modelFileName}
                      </a>
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
                <FormTextNotEditableItem
                  label="New dataset Id"
                  helpText="The dataset contains the generated data of the simulation"
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
                      this.props.stopSimulation(modelFileName);
                    }}
                    danger
                    style={{ marginRight: 10 }}
                  >
                    <StopOutlined /> Stop
                  </Button>
                  <a
                    href={`/logs/simulations?logFile=${logFile}`}
                    target="_blank"
                  >
                    <Button type="default" style={{ marginRight: 10 }}>
                      <FileTextOutlined /> View Simulation Log
                    </Button>
                  </a>
                  <a href={`/reports/${report.id}`} target="_blank">
                    <Button type="default" style={{ marginRight: 10 }}>
                      <FileExcelOutlined /> View Simulation Report
                    </Button>
                  </a>
                </Form.Item>
              </Form>
            </Card>
            <a href={`/logs/simulations`} target="_blank">
              <Button type="default" style={{ marginRight: 10 }}>
                <FileTextOutlined /> View All Simulation Logs
              </Button>
            </a>
            <a href={`/reports`} target="_blank">
              <Button type="default" style={{ marginRight: 10 }}>
                <FileExcelOutlined /> View All Simulation Reports
              </Button>
            </a>
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
        <Card style={{ marginBottom: 10 }}>
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
            <Card
              size="small"
              type="inner"
              title="Setup the dataset to store the generated data of the simulation"
              style={{ marginBottom: 10 }}
            >
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
                onChange={(value) =>
                  this.onDatasetTagsChange(JSON.parse(value))
                }
              />
            </Card>
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
              <PlayCircleOutlined /> Start
            </Button>
          </Form>
        </Card>
        <a href={`/logs/simulations`} target="_blank">
          <Button type="default" style={{ marginRight: 10 }}>
            <FileTextOutlined /> View All Simulation Logs
          </Button>
        </a>
        <a href={`/reports`} target="_blank">
          <Button type="default" style={{ marginRight: 10 }}>
            <FileExcelOutlined /> View All Simulation Reports
          </Button>
        </a>
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
