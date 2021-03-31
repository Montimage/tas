import React, { Component } from "react";
import { connect } from "react-redux";
import moment from "moment";
import { Table, Button, Tag, Menu, Dropdown, Card, Form } from "antd";
import {
  DeleteOutlined,
  EyeOutlined,
  DownOutlined,
  CaretRightOutlined,
  OrderedListOutlined,
} from "@ant-design/icons";
import LayoutPage from "./LayoutPage";
import { requestAllReports, requestDeleteReport } from "../actions";
import { getQuery } from "../utils";
import { FormTextNotEditableItem } from "../components/FormItems";

class ReportListPage extends Component {
  componentDidMount() {
    const topologyFileName = getQuery("topologyFileName");
    const testCampaignId = getQuery("testCampaignId");
    const reportToken = getQuery("reportToken");
    this.props.fetchReports({ topologyFileName, testCampaignId, reportToken });
  }

  render() {
    const { reports, deleteReport } = this.props;
    let pageSubTitle = "All reports";
    const topologyFileName = getQuery("topologyFileName");
    if (topologyFileName) {
      pageSubTitle = `${pageSubTitle} of topology: ${topologyFileName}. `;
    }
    const testCampaignId = getQuery("testCampaignId");
    if (testCampaignId) {
      pageSubTitle = `${pageSubTitle} of test campaign: ${testCampaignId}`;
    }
    const reportToken = getQuery("reportToken");
    const dataSource = reports.map((ds, index) => ({ ...ds, key: index }));
    const columns = [
      {
        title: "Created At",
        key: "data",
        sorter: (a, b) => a.createdAt - b.createdAt,
        render: (ds) => moment(ds.createdAt).format("MMMM Do YYYY, h:mm:ss a"),
      },
      {
        title: "DatasetId",
        key: "data",
        sorter: (a, b) =>
          a.originalDatasetId
            ? a.originalDatasetId.localeCompare(b.originalDatasetId)
            : 0,
        render: (ds) => (
          <a href={`/data-sets/${ds.originalDatasetId}`}>
            {ds.originalDatasetId}
          </a>
        ),
      },
      {
        title: "Topology",
        key: "data",
        sorter: (a, b) => a.topologyFileName.localeCompare(b.topologyFileName),
        render: (ds) => (
          <a href={`/models/${ds.topologyFileName}`}> {ds.topologyFileName} </a>
        ),
      },
      {
        title: "Score",
        key: "data",
        sorter: (a, b) => a.score - b.score,
        render: (ds) => (
          <div>
            {ds.score > -1 ? (
              <div>
                {ds.score < 0.5 ? (
                  <Tag color={"red"}>
                    Failed ({Math.round(ds.score * 100) / 100})
                  </Tag>
                ) : (
                  <Tag color={"green"}>
                    {" "}
                    Passed ({Math.round(ds.score * 100) / 100})
                  </Tag>
                )}
              </div>
            ) : (
              <Tag>Unknown</Tag>
            )}
          </div>
        ),
      },
      {
        title: "Action",
        key: "data",
        render: (ds) => (
          <Dropdown
            overlay={
              <Menu>
                <Menu.Item
                  key="view-detail"
                  title={"Show detail of this report"}
                >
                  <a href={`/reports/${ds.id}`}>
                    <EyeOutlined /> View Detail
                  </a>
                </Menu.Item>
                <Menu.Item
                  key="simulation"
                  title={"Re-do the test of this report"}
                >
                  <a
                    href={`/simulation?model=${ds.topologyFileName}&datasetId=${ds.originalDatasetId}`}
                  >
                    <CaretRightOutlined /> Simulate
                  </a>
                </Menu.Item>
                {!testCampaignId && ds.testCampaignId && ds.reportToken && (
                  <Menu.Item
                    key="simulation"
                    title={"Re-do the test of this report"}
                  >
                    <a
                      href={`/reports/?testCampaignId=${ds.testCampaignId}&reportToken=${ds.reportToken}`}
                    >
                      <OrderedListOutlined /> View all reports in the same test
                    </a>
                  </Menu.Item>
                )}
                <Menu.Item
                  key="delete"
                  danger
                  onClick={() => deleteReport(ds._id)}
                  title={"Delete this report"}
                >
                  <DeleteOutlined /> Delete
                </Menu.Item>
              </Menu>
            }
          >
            <a
              className="ant-dropdown-link"
              onClick={(e) => e.preventDefault()}
            >
              <Button>
                Select Action <DownOutlined />
              </Button>
            </a>
          </Dropdown>
        ),
      },
    ];
    return (
      <LayoutPage pageTitle="Reports" pageSubTitle={pageSubTitle}>
        {(testCampaignId || topologyFileName) && (
          <Card title="Overview" size="small" style={{ marginBottom: 10 }}>
            <Form labelCol={{ span: 4 }} wrapperCol={{ span: 14 }}>
              {testCampaignId && (
                <FormTextNotEditableItem
                label="Test Campaign Id"
                value={testCampaignId}
              />
              )}
              {topologyFileName && (
                <FormTextNotEditableItem
                label="Topology File Name"
                value={topologyFileName}
              />
              )}

              {reportToken && (
                <FormTextNotEditableItem
                label="Test started time"
                value={Date(reportToken)}
              />
              )}

            </Form>
          </Card>
        )}
        <Table columns={columns} dataSource={dataSource} bordered />
      </LayoutPage>
    );
  }
}

const mapPropsToStates = ({ reports }) => ({
  reports: reports.allReports,
});

const mapDispatchToProps = (dispatch) => ({
  fetchReports: (options) => dispatch(requestAllReports(options)),
  deleteReport: (reportId) => dispatch(requestDeleteReport(reportId)),
});

export default connect(mapPropsToStates, mapDispatchToProps)(ReportListPage);
