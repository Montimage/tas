import React, { Component } from "react";
import moment from "moment";
import { connect } from "react-redux";
import { Table, Button, PageHeader } from "antd";
import { getCreatedTimeFromFileName, getLastPath, getQuery } from "../utils";

import {
  requestAllLogFiles,
  requestDeleteLogFile,
  requestLogFile,
} from "../actions";
import LayoutPage from "./LayoutPage";
import LogFileContent from "./LogFileContent";

class LogsPage extends Component {
  constructor(props) {
    super(props);
    this.state = {
      tool: null,
      isLogPage: false,
      logFile: null,
    };
  }

  componentDidMount() {
    const tool = getLastPath();
    const logFile = getQuery("logFile");
    const { fetchAllLogFiles, fetchLogs } = this.props;
    if (logFile) {
      fetchLogs(tool, logFile);
      this.setState({ tool, isLogPage: true, logFile });
    } else {
      fetchAllLogFiles(tool);
      this.setState({ tool, isLogPage: false });
    }
  }

  render() {
    const { logFiles, logs, deleteLogFile } = this.props;
    const { tool, isLogPage, logFile } = this.state;
    if (isLogPage) {
      return <LogFileContent logs={logs} logFile={logFile} />;
    }
    const dataSource = logFiles.map((file, index) => ({
      name: file,
      key: index,
      createdAt: getCreatedTimeFromFileName(file),
    }));
    const columns = [
      {
        title: "Log File",
        key: "name",
        dataIndex: "name",
        sorter: (a, b) => a.name.localeCompare(b.name),
        render: (name) => <a href={`/logs/${tool}?logFile=${name}`}>{name}</a>,
      },
      {
        title: "CreatedAt",
        key: "createdAt",
        dataIndex: "createdAt",
        sorter: (a, b) => a.createdAt - b.createdAt,
        render: (createdAt) => moment(createdAt).fromNow(),
      },
      {
        title: "Action",
        render: (file) => (
          <Button
            danger
            size="small"
            onClick={() => deleteLogFile(tool, file.name)}
          >
            Delete
          </Button>
        ),
      },
    ];
    return (
      <LayoutPage>
        <PageHeader
          className="site-page-header"
          title={`${logFiles.length} Log Files`}
        />
        <Table columns={columns} dataSource={dataSource} />
      </LayoutPage>
    );
  }
}

const mapPropsToStates = ({ logs }) => ({
  logFiles: logs.logFiles,
  logs: logs.logs,
});

const mapDispatchToProps = (dispatch) => ({
  deleteLogFile: (tool, logFile) => {
    dispatch(requestDeleteLogFile({ tool, logFile }));
  },
  fetchLogs: (tool, logFile) => dispatch(requestLogFile({ tool, logFile })),
  fetchAllLogFiles: (tool) => dispatch(requestAllLogFiles(tool)),
});

export default connect(mapPropsToStates, mapDispatchToProps)(LogsPage);
