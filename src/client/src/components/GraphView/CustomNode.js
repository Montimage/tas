import React from "react";
import {
  BulbOutlined,
  BugOutlined,
  PartitionOutlined,
} from "@ant-design/icons";
import { Popover, Avatar, Badge } from "antd";
import "./CustomNode.css";
const StatsView = ({ id, stats, children }) => (
  <div>
    {stats.status && (
      <p>
        <Badge
          status={stats.status === "SIMULATING" ? "processing" : "error"}
          text={stats.status}
          className={stats.status}
        />
      </p>
    )}
    <p>Id: {id}</p>
    <p>Started Time: {(new Date(stats.startedTime)).toLocaleTimeString()}</p>
    <p>Last Activity: {(new Date(stats.lastActivity)).toLocaleTimeString()}</p>
    {children}
  </div>
);

// the graph configuration, you only need to pass down properties
// that you want to override, otherwise default ones will be used
const CustomNode = ({ data }) => {
  const { id, stats, devType } = data;
  let icon = <PartitionOutlined />;
  let popOverContent = (
    <div>
      <p>Id: {id}</p>
    </div>
  );
  switch (devType) {
    case "GATEWAY":
      icon = <PartitionOutlined />;
      if (stats) {
        popOverContent = (
          <StatsView id={id} stats={stats}>
            <p>
              Sent:{" "}
              <Badge
                overflowCount={10000}
                showZero={true}
                count={stats.numberOfSentData}
                style={{ backgroundColor: "#52c41a" }}
              />
            </p>
            <p>
              Received:{" "}
              <Badge
                overflowCount={10000}
                showZero={true}
                count={
                  stats.numberOfReceivedData ? stats.numberOfReceivedData : 0
                }
              />
            </p>
          </StatsView>
        );
      }
      break;
    case "SENSOR":
      icon = <BugOutlined />;
      if (stats) {
        popOverContent = (
          <StatsView id={id} stats={stats}>
            <p>
              Sent:{" "}
              <Badge
                overflowCount={10000}
                showZero={true}
                count={stats.numberOfSentData}
                style={{ backgroundColor: "#52c41a" }}
              />
            </p>
          </StatsView>
        );
      }

      break;
    case "ACTUATOR":
      icon = <BulbOutlined />;
      if (stats) {
        popOverContent = (
          <StatsView id={id} stats={stats}>
            <p>
              Received:{" "}
              <Badge
                overflowCount={10000}
                showZero={true}
                count={stats.numberOfReceivedData}
              />
            </p>
            {stats.lastReceivedData && (
              <p>Last Received Data: {stats.lastReceivedData}</p>
            )}
          </StatsView>
        );
      }
      break;
    default:
      break;
  }

  return (
    <Popover content={popOverContent} title={`${data.devType}: ${data.name}`}>
      <Avatar style={{ verticalAlign: "middle" }} icon={icon} />
    </Popover>
  );
};

export default CustomNode;
