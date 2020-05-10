import React, { Component } from "react";
import { connect } from "react-redux";
import { List, Skeleton, Avatar, Button, Spin, PageHeader } from "antd";
import { ClockCircleOutlined } from "@ant-design/icons";
import { getCreatedTimeFromFileName, isDataGenerator } from "../utils";

import { requestLogFiles, requestDeleteLogFile } from "../actions";

class LogsPage extends Component {
  componentDidMount() {
    this.props.initData(isDataGenerator());
  }

  render() {
    const { logFiles, deleteLogFile, requesting } = this.props;
    const isDG = isDataGenerator();
    if (requesting) {
      return <Spin tip="Loading..." />;
    }
    return (
      <React.Fragment>
        <PageHeader className="site-page-header" title="Log files" />
        <List
          bordered
          dataSource={logFiles}
          renderItem={(item) => (
            <List.Item
              actions={[
                <Button
                  key="list-loadmore-edit"
                  onClick={() => deleteLogFile(isDG, item)}
                  type="danger"
                >
                  Delete
                </Button>,
              ]}
            >
              <Skeleton avatar title={false} loading={item.loading}>
                <List.Item.Meta
                  avatar={
                    <Avatar>
                      <ClockCircleOutlined />
                    </Avatar>
                  }
                  title={
                    <a href={`${isDG ? "/data-generator" : ""}/logs/${item}`}>
                      {item}
                    </a>
                  }
                  description={`Created at: ${getCreatedTimeFromFileName(
                    item
                  )}`}
                />
              </Skeleton>
            </List.Item>
          )}
        />
      </React.Fragment>
    );
  }
}

const mapPropsToStates = ({ requesting, logs }) => ({
  requesting,
  logFiles: logs.logFiles,
});

const mapDispatchToProps = (dispatch) => ({
  deleteLogFile: (isDG, logFile) => {
    dispatch(requestDeleteLogFile({ isDG, logFile }));
  },
  initData: (isDG) => {
    dispatch(requestLogFiles(isDG));
  },
});

export default connect(mapPropsToStates, mapDispatchToProps)(LogsPage);
