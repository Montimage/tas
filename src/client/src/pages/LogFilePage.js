import React, { Component } from "react";
import { connect } from "react-redux";
import { Row, Col, Typography, PageHeader } from "antd";
import { getLastURLPath, isDataGenerator } from "../utils";
import LayoutPage from "./LayoutPage";
import { requestLogs } from "../actions";

const { Text } = Typography;

const LogLine = ({ type, time, device, message }) => (
  <Row>
    <Col span={4}>
      <Text type={type}>{time}</Text>
    </Col>
    <Col span={5}>
      <Text type={type}>{device}</Text>
    </Col>
    <Col span={15}>
      <Text type={type}>{message}</Text>
    </Col>
  </Row>
);

class LogsPage extends Component {
  constructor(props) {
    super(props);
    this.state = {
      logFile: null,
      isDG: false,
    };
  }
  componentDidMount() {
    const logFile = getLastURLPath(window.location.pathname);
    const isDG = isDataGenerator();
    this.setState({ logFile: decodeURIComponent(logFile) });
    this.props.requestLogs(isDG, logFile);
    setInterval(() => {
      this.props.requestLogs(isDG, logFile);
    }, 5000);
  }

  render() {
    const { logFile } = this.state;
    const { logs } = this.props;
    return (
      <LayoutPage>
        <PageHeader className="site-page-header" title={logFile} />
        <LogLine
          key={-1}
          type={"warning"}
          time={"Time"}
          device={"Device"}
          message={"Message"}
        />
        {!logs ? (
          <p>Empty</p>
        ) : (
          logs.split("\n").map((log, index) => {
            const array = log.split(" ");
            if (array.length < 4) {
              console.warn("Log is not going to show: ", log);
              return null;
            }
            const type = array[2] === "info:" ? "secondary" : "danger";
            const time = new Date(array[0]);
            const timeString = `${time.getHours()}:${time.getMinutes()}:${time.getSeconds()} ${time.getDay()}/${time.getMonth()}/${time.getFullYear()}`;
            const device = array[3].replace("[", "").replace("]", "");
            const message = log.split(array[3])[1];
            return (
              <LogLine
                key={index}
                type={type}
                time={timeString}
                device={device}
                message={message}
              />
            );
          })
        )}
      </LayoutPage>
    );
  }
}

const mapPropsToStates = ({ logs }) => ({
  logs: logs.logs,
  logFile: logs.logFile,
});

const mapDispatchToProps = (dispatch) => ({
  requestLogs: (isDG, logFile) => dispatch(requestLogs({ isDG, logFile })),
});

export default connect(mapPropsToStates, mapDispatchToProps)(LogsPage);
