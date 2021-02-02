import React, { Component, Fragment } from "react";
import { connect } from "react-redux";
import { Table, Button, Form, Alert } from "antd";
import { BuildOutlined, CopyOutlined, DeleteOutlined } from "@ant-design/icons";
import LayoutPage from "./LayoutPage";
import {
  requestAllTestCampaigns,
  requestAddNewTestCampaign,
  requestDeleteTestCampaign,
  requestDevops,
  requestUpdateDevops,
  requestLaunchTestCampaign,
  requestStopTestCampaign,
  requestTestCampaignStatus,
} from "../actions";
import {
  FormEditableTextItem,
  FormNumberItem,
  FormSelectItem,
  FormTextNotEditableItem,
} from "../components/FormItems";
import CollapseForm from "../components/CollapseForm";
import { updateObjectByPath } from "../utils";
import {URL} from '../api';

class TestCampaignListPage extends Component {
  constructor(props) {
    super(props);
    this.state = {
      webhookURL: undefined,
      testCampaignId: "Select the test Campaign for next build",
      isChanged: false,
      evaluationParameters: null,
    };
  }

  componentDidMount() {
    this.props.fetchTestCampaigns();
    this.props.fetchDevops();
    this.props.fetchTestCampaignStatus();
    this.testCampaignStatusTimer = setInterval(() => {
      this.props.fetchTestCampaignStatus();
    }, 3000);
  }

  componentWillUnmount() {
    clearInterval(this.testCampaignStatusTimer);
  }

  componentWillReceiveProps(newProps) {
    if (newProps.devops) {
      this.setState(newProps.devops);
    }
  }

  duplicateTestCampaign(tc) {
    const newTc = {
      id: `${tc.id}-[duplicated]`,
      name: `${tc.name}-[duplicated]`,
      description: tc.description,
      testCaseIds: tc.testCaseIds,
    };
    this.props.addNewTestCampaign(newTc);
  }

  onDataChange(dataPath, value) {
    this.setState((prevState) => {
      const newData = { ...prevState };
      updateObjectByPath(newData, dataPath, value);
      return { ...newData, isChanged: true };
    });
  }

  render() {
    const {
      testCampaigns,
      deleteTestCampaign,
      updateDevops,
      launchTestCampaign,
      stopTestCampaign,
      runningStatus,
    } = this.props;
    const { webhookURL, testCampaignId, isChanged, evaluationParameters } = this.state;
    const dataSource = testCampaigns.map((tc) => ({ ...tc, key: tc.id }));
    const columns = [
      {
        title: "Id",
        key: "data",
        render: (tc) => (
          <a href={`/test-campaigns/${tc.id}`}>
            {tc.id === testCampaignId ? (
              <strong>
                {tc.id} <span style={{ color: "green" }}>**selected**</span>
              </strong>
            ) : (
              tc.id
            )}
          </a>
        ),
      },
      {
        title: "Action",
        key: "data",
        width: 400,
        render: (tc) => (
          <Fragment>
            <Button
              size="small"
              onClick={() => this.onDataChange('testCampaignId',tc.id)}
              style={{ marginRight: 10 }}
              disabled={tc.id === testCampaignId ? true: false}
            >
              <BuildOutlined /> Select
            </Button>
            <Button
              size="small"
              style={{ marginRight: 10 }}
              onClick={() => this.duplicateTestCampaign(tc)}
            >
              {" "}
              <CopyOutlined /> Duplicate
            </Button>
            {tc.reportFileName && (
              <Button
                size="small"
                style={{ marginRight: 10 }}
                onClick={() =>
                  console.log(
                    "[TestCampaignList] View report of test campaign: ",
                    tc
                  )
                }
              >
                <a href={`/reports/test-campaigns/${tc.reportFileName}`}>
                  View Report
                </a>
              </Button>
            )}
            <Button
              size="small"
              danger
              onClick={() => deleteTestCampaign(tc.id)}
            >
              <DeleteOutlined /> Delete
            </Button>
          </Fragment>
        ),
      },
    ];
    return (
      <LayoutPage
        pageTitle="Test Campaign"
        pageSubTitle="Setup automation testing"
      >
        <CollapseForm title="Configuration for automation testing" active={true}>
          <Form labelCol={{ span: 4 }} wrapperCol={{ span: 14 }}>
            <FormTextNotEditableItem
              label={"Trigger URL"}
              value={(<Alert message={`${URL}/api/devops/start`}/>)}
              helpText={`The end point to launch the test campaign`}
            />
            <FormEditableTextItem
              label="Webhook URL"
              defaultValue={webhookURL}
              onChange={(wb) => this.onDataChange('webhookURL',wb)}
              helpText={`The end point to send the result of the test to`}
            />
            <FormTextNotEditableItem
              label="Selected Test Campaign"
              value={
                <a href={`/test-campaigns/${testCampaignId}`}>
                  <strong>{testCampaignId}</strong>
                </a>
              }
              helpText={"The test campaign that will be executed in automation testing"}
            />
            {evaluationParameters ? (
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
            ):(
              <Button
                onClick={() => this.onDataChange('evaluationParameters', {
                  eventType: "ALL_EVENTS",
                  metricType: "METRIC_VALUE_TIMESTAMP",
                  threshold: 0.5
                })}
                style={{marginBottom: 10}}
              >
                Set Evaluation Parameters
              </Button>
            )}
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
                onClick={() => {
                  updateDevops({
                    webhookURL,
                    testCampaignId,
                    evaluationParameters
                  });
                  this.setState({ isChanged: false });
                }}
                disabled={isChanged ? false : true}
                style={{marginRight: 10}}
                type="primary"
              >
                Save
              </Button>
              {runningStatus ? (
                <Fragment>
                  {runningStatus.isRunning ? (
                    <Button
                      type="primary"
                      danger
                      onClick={() => stopTestCampaign()}
                    >
                      Stop
                    </Button>
                  ) : (
                    <Button
                      type="primary"
                      onClick={() => launchTestCampaign()}
                      disabled={isChanged ? true : false}
                    >
                      Launch
                    </Button>
                  )}
                  <a
                    href={`/logs/test-campaigns?logFile=${runningStatus.logFile}`}
                  >
                    <Button type="link">View Log</Button>
                  </a>
                  <a href={`/reports/?testCampaignId=${testCampaignId}`}>
                    <Button type="link">View Report</Button>
                  </a>
                </Fragment>
              ) : (
                <Button
                  type="primary"
                  onClick={() => launchTestCampaign()}
                  disabled={isChanged ? true : false}
                >
                  Launch
                </Button>
              )}
            </Form.Item>
          </Form>
        </CollapseForm>
        <a href={`/test-campaigns/new-campaign-${Date.now()}`}>
          <Button style={{ marginBottom: "10px" }}>Add New Campaign</Button>
        </a>
        <Table columns={columns} dataSource={dataSource} />
        <p></p>
        <a href={`/logs/test-campaigns`}>View All Test Campaign Logs</a>
      </LayoutPage>
    );
  }
}

const mapPropsToStates = ({ testCampaigns, devops }) => ({
  testCampaigns: testCampaigns.allTestCampaigns,
  runningStatus: testCampaigns.runningStatus,
  devops,
});

const mapDispatchToProps = (dispatch) => ({
  fetchTestCampaigns: () => dispatch(requestAllTestCampaigns()),
  fetchDevops: () => dispatch(requestDevops()),
  fetchTestCampaignStatus: () => dispatch(requestTestCampaignStatus()),
  updateDevops: (newDevops) => dispatch(requestUpdateDevops(newDevops)),
  deleteTestCampaign: (testCampaignId) =>
    dispatch(requestDeleteTestCampaign(testCampaignId)),
  addNewTestCampaign: (testCampaign) =>
    dispatch(requestAddNewTestCampaign(testCampaign)),
  launchTestCampaign: () => dispatch(requestLaunchTestCampaign()),
  stopTestCampaign: () => dispatch(requestStopTestCampaign()),
});

export default connect(
  mapPropsToStates,
  mapDispatchToProps
)(TestCampaignListPage);
