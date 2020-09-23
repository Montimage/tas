import React, { Component, Fragment } from "react";
import { connect } from "react-redux";
import { Table, Menu, Dropdown, Button, Tooltip, Form } from "antd";
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
  FormTextNotEditableItem,
} from "../components/FormItems";
import { getLastPath, updateObjectByPath } from "../utils";
import EventStream from "../components/EventStream/EventStream";

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
        score,
        testCampaignId,
      } = report;
      this.state = {
        _id,
        createdAt,
        topologyFileName,
        originalDatasetId,
        newDatasetId,
        startTime,
        endTime,
        score,
        testCampaignId,
        originalEvents,
        newEvents,
        isChanged: false,
      };
    } else {
      this.state = {};
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
        score,
        testCampaignId,
      } = report;
      if (!this.state.fetchedOriginalEvents) {
        this.props.fetchOriginalEvents(originalDatasetId);
        this.setState({ fetchedOriginalEvents: true });
      }

      if (!this.state.fetchedNewEvents) {
        this.props.fetchNewEvents(newDatasetId);
        this.setState({ fetchedNewEvents: true });
      }

      this.setState({
        _id,
        createdAt,
        topologyFileName,
        originalDatasetId,
        newDatasetId,
        startTime,
        endTime,
        score,
        testCampaignId,
        isChanged: false,
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
      score,
      testCampaignId,
    } = this.state;
    this.props.updateReport(_id, {
      createdAt,
      topologyFileName,
      originalDatasetId,
      newDatasetId,
      startTime,
      endTime,
      score,
      testCampaignId,
    });
    this.setState({ isChanged: false });
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
      score,
      testCampaignId,
      isChanged,
      originalEvents,
      newEvents,
    } = this.state;
    let sourceEvents = [];
    if (originalEvents) {
      sourceEvents = originalEvents.filter(
        (e) => e.timestamp > startTime && e.timestamp < endTime
      );
      // console.log(sourceEvents);
    }
    return (
      <LayoutPage pageTitle={`Report ${_id}`} pageSubTitle="Report detail">
        <Form labelCol={{ span: 4 }} wrapperCol={{ span: 14 }}>
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
        {sourceEvents && (
          <EventStream
            events={sourceEvents}
            title={`Dataset: ${originalDatasetId} (${sourceEvents.length})`}
          />
        )}
        {newEvents && (
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
  fetchOriginalEvents: (datasetId) =>
    dispatch(requestOriginalEvents(datasetId)),
  fetchNewEvents: (datasetId) => dispatch(requestNewEvents(datasetId)),
  fetchReport: (reportId) => dispatch(requestReport(reportId)),
  updateReport: (originalId, updatedReport) =>
    dispatch(
      requestUpdateReport({
        id: originalId,
        report: updatedReport,
      })
    ),
});

export default connect(mapPropsToStates, mapDispatchToProps)(ReportPage);

// TODO: load more data in the table
