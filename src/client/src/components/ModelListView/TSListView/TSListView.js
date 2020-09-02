import React from "react";
import { List, Avatar, Skeleton, Button, Switch } from "antd";

const TSListView = ({
  list,
  editHandler,
  deleteHandler,
  itemAvatar,
  changeStatus,
}) => (
  <List
    itemLayout="horizontal"
    dataSource={list}
    renderItem={(item) => (
      <List.Item
        actions={[
          <Button
            key="item-edit"
            size="small"
            onClick={() => editHandler(item)}
          >
            Edit
          </Button>,
          <Button
            key="item-delete"
            size="small"
            onClick={() => deleteHandler(item)}
            type="danger"
          >
            Delete
          </Button>,
          <Switch
            key="item-enable"
            onChange={() => changeStatus(item)}
            checkedChildren={"Enable"}
            unCheckedChildren={"Disable"}
            checked={item.enable}
          />,
        ]}
      >
        <Skeleton avatar title={false} loading={item.loading}>
          <List.Item.Meta
            avatar={<Avatar>{itemAvatar}</Avatar>}
            title={
              <span onClick={() => editHandler(item)} style={{cursor:'pointer'}}>
                {item.name ? item.name : item.id}
              </span>
            }
            description={`Id: ${item.id}${
              item.name ? `- name: ${item.name}` : ""
            }- enable: ${item.enable ? true : false}`}
          />
        </Skeleton>
      </List.Item>
    )}
  />
);

export default TSListView;
