import React, { Component } from "react";
import { Row, Col, Typography, PageHeader } from "antd";
const { Text } = Typography;

// 2020-03-11T15:54:46.536Z [Simulation] info: [medicalGW-01-0] published: mqtt://localhost:1883 things/medicalGW-01-0/sensors/blood-pressure-sensor
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

const LogView = ({ logs, logFile, resetLogFile }) => (
  <React.Fragment>
    <PageHeader
      className="site-page-header"
      onBack={() => resetLogFile()}
      title={logFile}
    />
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
  </React.Fragment>
);

export default LogView;
