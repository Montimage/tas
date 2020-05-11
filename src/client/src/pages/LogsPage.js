import React, { Component } from "react";
import { connect } from "react-redux";
import { List, Skeleton, Avatar, Button, PageHeader } from "antd";
import { ClockCircleOutlined } from "@ant-design/icons";
import { getCreatedTimeFromFileName, isDataGenerator } from "../utils";

import { requestLogFiles, requestDeleteLogFile } from "../actions";
import LayoutPage from "./LayoutPage";

class LogsPage extends Component {
  constructor(props) {
    super(props);
    this.state = {
      logFiles: props.logFiles,
    };
  }

  componentDidMount() {
    this.props.initData(isDataGenerator());
  }

  componentWillReceiveProps(newProps) {
    this.setState({ logFiles: newProps.logFiles });
  }

  render() {
    const { deleteLogFile } = this.props;
    const { logFiles } = this.state;
    const isDG = isDataGenerator();
    return (
      <LayoutPage>
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
      </LayoutPage>
    );
  }
}

const mapPropsToStates = ({ logs }) => ({
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
