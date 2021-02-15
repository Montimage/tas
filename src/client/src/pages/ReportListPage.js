import React, { Component, Fragment } from "react";
import { connect } from "react-redux";
import moment from "moment";
import { Table, Button, Tag, Menu, Dropdown } from "antd";
import { DeleteOutlined, EyeOutlined, DownOutlined, CaretRightOutlined } from "@ant-design/icons";
import LayoutPage from "./LayoutPage";
import { requestAllReports, requestDeleteReport } from "../actions";
import { getQuery } from "../utils";

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
        render: (ds) => (
          <a href={`/data-sets/${ds.originalDatasetId}`}>
            {ds.originalDatasetId}
          </a>
        ),
      },
      {
        title: "Topology",
        key: "data",
        render: (ds) => (
          <a href={`/models/${ds.topologyFileName}`}> {ds.topologyFileName} </a>
        ),
      },
      {
        title: "Score",
        key: "data",
        render: (ds) => (
          <div>
            {ds.score > -1 ? (
              <div>
                {ds.score < 0.5 ? (
                  <Tag color={"red"}>Failed ({Math.round(ds.score * 100)/100})</Tag>
                ) : (
                  <Tag color={"green"}> Passed ({Math.round(ds.score * 100)/100})</Tag>
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
                  key="delete"
                  danger
                  onClick={() => deleteReport(ds._id)}
                  title={"Delete this report"}
                >
                  <DeleteOutlined /> Delete
                </Menu.Item>
                <Menu.Item key="view-detail" title={"Show detail of this report"}>
                  <a href={`/reports/${ds.id}`}>
                    <EyeOutlined /> View Detail
                  </a>
                </Menu.Item>
                <Menu.Item key="simulation" title={"Re-do the test of this report"}>
                  <a href={`/simulation?model=${ds.topologyFileName}&datasetId=${ds.originalDatasetId}`}>
                    <CaretRightOutlined /> Simulate
                  </a>
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
        <Table columns={columns} dataSource={dataSource} />
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
