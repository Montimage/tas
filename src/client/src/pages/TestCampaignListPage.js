import React, { Component, Fragment } from "react";
import { connect } from "react-redux";
import { Table, Menu, Dropdown, Button, Form } from "antd";
import { DownOutlined, BuildOutlined, CopyOutlined, DeleteOutlined } from "@ant-design/icons";
import LayoutPage from "./LayoutPage";
import {
  requestAllTestCampaigns,
  requestAddNewTestCampaign,
  requestDeleteTestCampaign,
  requestDevOpts,
  requestUpdateDevOpts,
  requestLaunchTestCampaign,
  requestStopTestCampaign,
  requestTestCampaignStatus,
} from "../actions";
import {
  FormEditableTextItem,
  FormTextNotEditableItem,
  FormTextAreaItem,
} from "../components/FormItems";
import CollapseForm from "../components/CollapseForm";

class TestCampaignListPage extends Component {
  constructor(props) {
    super(props);
    this.state = {
      webhookURL: undefined,
      testCampaignId: "Select the test Campaign for next build",
      isChanged: false,
    };
  }

  componentDidMount() {
    this.props.fetchTestCampaigns();
    this.props.fetchDevOpts();
  }

  componentWillReceiveProps(newProps) {
    if (newProps.devOpts) {
      this.setState(newProps.devOpts);
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

  updateWebhookURL(wb) {
    this.setState({
      webhookURL: wb,
      isChanged: true,
    });
  }

  updateTestCampaignId(tcId) {
    this.setState({
      testCampaignId: tcId,
      isChanged: true,
    });
  }

  render() {
    const {
      testCampaigns,
      deleteTestCampaign,
      updateDevOpts,
      launchTestCampaign,
      stopTestCampaign,
      runningStatus,
    } = this.props;
    const { webhookURL, testCampaignId, isChanged } = this.state;
    const dataSource = testCampaigns.map((tc) => ({ ...tc, key: tc.id }));
    const columns = [
      {
        title: "Id",
        key: "data",
        render: (tc) => (
          <a href={`/test-campaigns/${tc.id}`}>
            {tc.id === testCampaignId ? (
              <strong>
                {tc.id} <span style={{ color: "green" }}>**Next Build**</span>
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
        width: 500,
        render: (tc) => (
          <Fragment>
            <Button
              size="small"
              onClick={() => this.updateTestCampaignId(tc.id)}
              style={{ marginRight: 10 }}
            >
              <BuildOutlined /> Select for next Build
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
        pageSubTitle="All the test campaigns"
      >
        <CollapseForm title="Configuration for next build" active={true}>
          <Form labelCol={{ span: 4 }} wrapperCol={{ span: 14 }}>
            <FormEditableTextItem
              label="WebhookURL"
              defaultValue={webhookURL}
              onChange={(wb) => this.updateWebhookURL(wb)}
            />
            <FormTextNotEditableItem
              label="Next build"
              value={
                <a href={`/test-campaigns/${testCampaignId}`}>
                  <strong>{testCampaignId}</strong>
                </a>
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
                onClick={() => {
                  updateDevOpts({
                    webhookURL,
                    testCampaignId,
                  });
                  this.setState({ isChanged: false });
                }}
                disabled={isChanged ? false : true}
                type="primary"
                style={{ marginRight: 10 }}
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
        <a href={`/logs/test-campaigns`}>View All Campaign Logs</a>
      </LayoutPage>
    );
  }
}

const mapPropsToStates = ({ testCampaigns, devOpts }) => ({
  testCampaigns: testCampaigns.allTestCampaigns,
  runningStatus: testCampaigns.runningStatus,
  devOpts,
});

const mapDispatchToProps = (dispatch) => ({
  fetchTestCampaigns: () => dispatch(requestAllTestCampaigns()),
  fetchDevOpts: () => dispatch(requestDevOpts()),
  fetchTestCampaignStatus: () => dispatch(requestTestCampaignStatus()),
  updateDevOpts: (newDevOpts) => dispatch(requestUpdateDevOpts(newDevOpts)),
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
