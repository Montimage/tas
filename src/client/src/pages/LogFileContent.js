import React from "react";
import { Row, Col, Typography, PageHeader } from "antd";
import LayoutPage from "./LayoutPage";

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

const LogFileContent = ({ logs, logFile }) => (
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

export default LogFileContent;
