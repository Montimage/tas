import React from "react";
import { List } from "antd";

const LogFileView = ({ logFiles, selectLogFile }) =>
  logFiles.length === 0 ? (
    <p>There is not any log file!</p>
  ) : (
    <List
      bordered
      dataSource={logFiles}
      renderItem={item => (
        <List.Item
          onClick={() => selectLogFile(item)}
          style={{ cursor: "pointer" }}
        >
          {item}
        </List.Item>
      )}
    />
  );

export default LogFileView;
