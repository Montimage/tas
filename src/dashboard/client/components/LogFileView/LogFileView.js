import React from "react";
import { List, Skeleton, Avatar, Button } from "antd";
import {ClockCircleOutlined} from '@ant-design/icons';
import { getCreatedTimeFromFileName } from "../../utils";

const LogFileView = ({ logFiles, selectLogFile, deleteHandler }) =>
  logFiles.length === 0 ? (
    <p>There is not any log file!</p>
  ) : (
    <List
      bordered
      dataSource={logFiles}
      renderItem={item => (
        <List.Item
        actions={[
          <Button
            key="list-loadmore-edit"
            onClick={() => deleteHandler(item)}
            type="danger"
          >
            Delete
          </Button>
        ]}
      >
        <Skeleton avatar title={false} loading={item.loading}>
          <List.Item.Meta
              avatar={<Avatar><ClockCircleOutlined /></Avatar>}
              title={
                <a onClick={() => selectLogFile(item)}>
                  {item}
                </a>
              }
              description={`Created at: ${getCreatedTimeFromFileName(item)}`}
            />
          </Skeleton>
          </List.Item>
      )}
    />
  );

export default LogFileView;
