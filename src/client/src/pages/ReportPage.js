import React, { Component } from "react";
import { connect } from "react-redux";
import { Button, Form } from "antd";
import moment from "moment";
import LayoutPage from "./LayoutPage";
import {
  requestReport,
  requestUpdateReport,
  requestOriginalEvents,
  requestNewEvents,
} from "../actions";
import {
  FormEditableTextItem,
  FormNumberItem,
  FormSelectItem,
  FormTextNotEditableItem,
} from "../components/FormItems";
import { deepCloneObject, getLastPath, updateObjectByPath } from "../utils";
import EventStream from "../components/EventStream/EventStream";
import CollapseForm from "../components/CollapseForm";

/**
 *
- id
- createdAt
- topologyFileName
- originalDatasetId
- newDatasetId
- startTime
- endTime
- score: Number
- testCampaignId: can be null

 */

class ReportPage extends Component {
  constructor(props) {
    super(props);
    const { report, originalEvents, newEvents } = props;
    if (report) {
      const {
        _id,
        createdAt,
        topologyFileName,
        originalDatasetId,
        newDatasetId,
        startTime,
        endTime,
        testCampaignId,
        score,
        evaluationParameters,
      } = report;
      this.state = {
        _id,
        createdAt,
        topologyFileName,
        originalDatasetId,
        newDatasetId,
        startTime,
        endTime,
        testCampaignId,
        score,
        evaluationParameters: deepCloneObject(evaluationParameters),
        isChanged: false,
        page: 0,
        originalEvents,
        newEvents,
        calculateScore: false
      };
    } else {
      this.state = {
        page: 0,
      };
    }
  }

  componentDidMount() {
    const reportId = getLastPath();
    this.props.fetchReport(reportId);
  }

  componentWillReceiveProps(newProps) {
    const { report, originalEvents, newEvents } = newProps;
    if (report) {
      const {
        _id,
        createdAt,
        topologyFileName,
        originalDatasetId,
        newDatasetId,
        startTime,
        endTime,
        testCampaignId,
        score,
        evaluationParameters,
      } = report;
      // if (!this.state.fetchedOriginalEvents) {
      //   this.props.fetchOriginalEvents(originalDatasetId, startTime ? startTime: 0, endTime ? endTime : Date.now(), this.state.page);
      //   this.setState({ fetchedOriginalEvents: true, page: (page +1) });
      // }

      // if (!this.state.fetchedNewEvents) {
      //   this.props.fetchNewEvents(newDatasetId, page );
      //   this.setState({ fetchedNewEvents: true , page: (page +1) });
      // }

      this.setState({
        _id,
        createdAt,
        topologyFileName,
        originalDatasetId,
        newDatasetId,
        startTime,
        endTime,
        testCampaignId,
        score,
        isChanged: false,
        evaluationParameters: deepCloneObject(evaluationParameters),
      });
    }
    if (originalEvents) {
      this.setState({
        originalEvents,
      });
    }
    if (newEvents) {
      this.setState({
        newEvents,
      });
    }
  }

  onDataChange(dataPath, value) {
    this.setState((prevState) => {
      const newData = { ...prevState };
      updateObjectByPath(newData, dataPath, value);
      if (dataPath.indexOf('evaluationParameters') > -1) {
        return { ...newData, isChanged: true, calculateScore: true };
      }
      return { ...newData, isChanged: true };
    });
  }

  saveReport() {
    const {
      _id,
      createdAt,
      topologyFileName,
      originalDatasetId,
      newDatasetId,
      startTime,
      endTime,
      testCampaignId,
      evaluationParameters,
      calculateScore,
      score
    } = this.state;
    this.props.updateReport(_id, {
      createdAt,
      topologyFileName,
      originalDatasetId,
      newDatasetId,
      startTime,
      endTime,
      testCampaignId,
      score,
      evaluationParameters,
    }, calculateScore);
    this.setState({ isChanged: false, calculateScore: false });
  }

  loadEvents() {
    const {
      page,
      originalDatasetId,
      newDatasetId,
      startTime,
      endTime,
    } = this.state;
    const { fetchOriginalEvents, fetchNewEvents } = this.props;
    fetchOriginalEvents(
      originalDatasetId,
      startTime ? startTime : 0,
      endTime ? endTime : Date.now(),
      this.state.page
    );
    fetchNewEvents(newDatasetId, page);
    this.setState({ page: page + 1 });
  }

  render() {
    if (!this.state) {
      return <p>Waiting for data</p>;
    }

    const {
      _id,
      createdAt,
      topologyFileName,
      originalDatasetId,
      newDatasetId,
      startTime,
      endTime,
      testCampaignId,
      isChanged,
      evaluationParameters,
      page,
      score,
    } = this.state;
    const { originalEvents, newEvents } = this.props;
    let sourceEvents = [];
    if (originalEvents) {
      sourceEvents = originalEvents.filter(
        (e) => e.timestamp > startTime && e.timestamp < endTime
      );
      // console.log(sourceEvents);
    }
    return (
      <LayoutPage pageTitle={`Report ${_id}`} pageSubTitle="Report detail">
        <Form labelCol={{ span: 8 }} wrapperCol={{ span: 16 }}>
          <FormTextNotEditableItem label="Id" value={_id} />
          <FormTextNotEditableItem
            label="Created At"
            value={moment(createdAt).format("MMMM Do YYYY, h:mm:ss a")}
          />
          <FormEditableTextItem
            label="Topology"
            defaultValue={topologyFileName}
            onChange={(newTopology) =>
              this.onDataChange("topologyFileName", newTopology)
            }
          />
          <FormEditableTextItem
            label="Test Campaign Id"
            defaultValue={testCampaignId}
            onChange={(newTestCampaignId) =>
              this.onDataChange("testCampaignId", newTestCampaignId)
            }
          />
          <FormEditableTextItem
            label="Original Dataset Id"
            defaultValue={originalDatasetId}
            onChange={(newOriginalDatasetId) =>
              this.onDataChange("originalDatasetId", newOriginalDatasetId)
            }
          />
          <FormEditableTextItem
            label="New Dataset Id"
            defaultValue={newDatasetId}
            onChange={(newNewDatasetId) =>
              this.onDataChange("newDatasetId", newNewDatasetId)
            }
          />
          <FormTextNotEditableItem
            label="Start Time"
            value={moment(startTime).format("MMMM Do YYYY, h:mm:ss a")}
          />
          <FormTextNotEditableItem
            label="End Time"
            value={moment(endTime).format("MMMM Do YYYY, h:mm:ss a")}
          />
          <FormTextNotEditableItem label="Score" value={score} />
          {evaluationParameters && (
            <CollapseForm
              title="Evaluation Parameters"
            >
              <FormSelectItem
                label="Event Type"
                helpText="Select the type of event to take into the evaluation"
                defaultValue={evaluationParameters.eventType}
                options={["ALL_EVENTS","SENSOR_EVENTS", "ACTUATOR_EVENTS"]}
                onChange={(eventType) => this.onDataChange('evaluationParameters.eventType', eventType)}
              />
              <FormSelectItem
                label="Metric Type"
                helpText="Select the type of metric to take into the evaluation"
                defaultValue={evaluationParameters.metricType}
                options={["METRIC_VALUE","METRIC_VALUE_TIMESTAMP", "METRIC_TIMESTAMP"]}
                onChange={(metricType) => this.onDataChange('evaluationParameters.metricType', metricType)}
              />
              <FormNumberItem
                label="Threshold"
                helpText="Set the threshold of the similarity to be evaluated as PASSED or FAILED"
                defaultValue={evaluationParameters.threshold}
                min={0}
                max={1}
                step={0.01}
                onChange={(threshold) => this.onDataChange('evaluationParameters.threshold', threshold)}
              />
            </CollapseForm>
          )}
        </Form>
        <Button
          onClick={() => this.saveReport()}
          disabled={isChanged ? false : true}
          type="primary"
          size="large"
          style={{
            position: "fixed",
            top: 80,
            right: 20,
          }}
        >
          Save
        </Button>
        <Button
          onClick={() => this.loadEvents()}
          size="large"
          style={{
            marginBottom: 10,
          }}
        >
          {page ? "Load More Events" : "Show Events"}
        </Button>
        {sourceEvents && page > 0 && (
          <EventStream
            events={sourceEvents}
            title={`Dataset: ${originalDatasetId} (${sourceEvents.length})`}
          />
        )}
        {newEvents && page > 0 && (
          <EventStream
            events={newEvents}
            title={`Dataset: ${newDatasetId} (${newEvents.length})`}
          />
        )}
      </LayoutPage>
    );
  }
}

const mapPropsToStates = ({ reports }) => ({
  report: reports.currentReport.report,
  originalEvents: reports.currentReport.originalEvents,
  newEvents: reports.currentReport.newEvents,
});

const mapDispatchToProps = (dispatch) => ({
  fetchReport: (reportId) => dispatch(requestReport(reportId)),
  fetchOriginalEvents: (datasetId, startTime, endTime, page) =>
    dispatch(requestOriginalEvents({ datasetId, startTime, endTime, page })),
  fetchNewEvents: (datasetId, page) =>
    dispatch(requestNewEvents({datasetId, page})),
  updateReport: (originalId, updatedReport, newScore) =>
    dispatch(
      requestUpdateReport({
        id: originalId,
        report: updatedReport,
        newScore
      })
    ),
});

export default connect(mapPropsToStates, mapDispatchToProps)(ReportPage);

// TODO: load more data in the table
