import React, { Component, Fragment } from "react";
import { connect } from "react-redux";
import moment from "moment";
import { Table, Button } from "antd";
import { DeleteOutlined } from "@ant-design/icons";
import LayoutPage from "./LayoutPage";
import { requestAllReports, requestDeleteReport } from "../actions";
import { getQuery } from "../utils";

class ReportListPage extends Component {
  componentDidMount() {
    const topologyFileName = getQuery("topologyFileName");
    const testCampaignId = getQuery("testCampaignId");
    this.props.fetchReports({ topologyFileName, testCampaignId });
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
        width: 270,
      },
      {
        title: "Id",
        key: "data",
        render: (ds) => <a href={`/reports/${ds.id}`}> {ds.id} </a>,
        width: 200,
      },
      {
        title: "Test Campaign Id",
        key: "data",
        render: (ds) => (
          <a href={`/test-campaigns/${ds.testCampaignId}`}>
            {" "}
            {ds.testCampaignId}{" "}
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
                {ds.score === 0 ? <p>{ds.score}</p> : <p>{ds.score}</p>}
              </div>
            ) : (
              <p>NA</p>
            )}
          </div>
        ),
      },
      {
        title: "Action",
        key: "data",
        width: 100,
        render: (ds) => (
          <Fragment>
            <Button size="small" danger onClick={() => deleteReport(ds._id)}>
              <DeleteOutlined /> Delete
            </Button>
          </Fragment>
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
