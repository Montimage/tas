import React, { Component, Fragment } from "react";
import { connect } from "react-redux";
import { Link } from "react-router-dom";
import dayjs from "dayjs";
import { Table, Button, Popconfirm } from "antd";
import { DeleteOutlined } from "@ant-design/icons";
import LayoutPage from "./LayoutPage";
import { ListStateEmpty, ListStateError } from "../components/ListStates";
import { requestAllReports, requestDeleteReport } from "../actions";
import { getQuery } from "../utils";

class ReportListPage extends Component {
  componentDidMount() {
    this.fetchPage(0);
  }

  fetchPage(skip) {
    const topologyFileName = getQuery("topologyFileName");
    const testCampaignId = getQuery("testCampaignId");
    this.props.fetchReports({ topologyFileName, testCampaignId, skip });
  }

  render() {
    const { reports, total, limit, skip, deleteReport, requesting, requestError, fetchReports } =
      this.props;
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
    // Server-side pagination: the table moves the window with `skip`, and
    // never asks for more than one page at a time (issue #85).
    const pagination = {
      pageSize: limit,
      total: Math.max(total, reports.length),
      current: Math.floor(skip / (limit || 1)) + 1,
      showSizeChanger: false,
      onChange: (page) => this.fetchPage((page - 1) * (limit || 1)),
    };
    const columns = [
      {
        title: "Created At",
        key: "data",
        sorter: (a, b) => a.createdAt - b.createdAt,
        render: (ds) => dayjs(ds.createdAt).format("MMMM Do YYYY, h:mm:ss a"),
        width: 270,
      },
      {
        title: "Id",
        key: "data",
        render: (ds) => <Link to={`/reports/${ds.id}`}> {ds.id} </Link>,
        width: 200,
      },
      {
        title: "Test Campaign Id",
        key: "data",
        render: (ds) => (
          <Link to={`/test-campaigns/${ds.testCampaignId}`}>
            {" "}
            {ds.testCampaignId}{" "}
          </Link>
        ),
      },
      {
        title: "Topology",
        key: "data",
        render: (ds) => (
          <Link to={`/models/${ds.topologyFileName}`}> {ds.topologyFileName} </Link>
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
            <Popconfirm
              title={`Delete report "${ds._id}"?`}
              description="This permanently removes the report. It cannot be undone."
              okText="Delete"
              okButtonProps={{ danger: true }}
              cancelText="Cancel"
              onConfirm={() => deleteReport(ds._id)}
            >
              <Button size="small" danger>
                <DeleteOutlined /> Delete
              </Button>
            </Popconfirm>
          </Fragment>
        ),
      },
    ];
    const emptyState =
      !requesting && requestError ? (
        <ListStateError message={requestError.message} onRetry={fetchReports} />
      ) : (
        <ListStateEmpty
          description="No reports yet"
          action={
            <Link to="/test-campaigns">
              <Button type="primary">Run a Test Campaign</Button>
            </Link>
          }
        />
      );
    return (
      <LayoutPage pageTitle="Reports" pageSubTitle={pageSubTitle}>
        <Table
          columns={columns}
          dataSource={dataSource}
          pagination={pagination}
          locale={{ emptyText: emptyState }}
        />
      </LayoutPage>
    );
  }
}

const mapPropsToStates = ({ reports, requesting, requestError }) => ({
  reports: reports.allReports,
  total: reports.total,
  limit: reports.limit,
  skip: reports.skip,
  requesting,
  requestError,
});

const mapDispatchToProps = (dispatch) => ({
  fetchReports: (options) => dispatch(requestAllReports(options)),
  deleteReport: (reportId) => dispatch(requestDeleteReport(reportId)),
});

export default connect(mapPropsToStates, mapDispatchToProps)(ReportListPage);
