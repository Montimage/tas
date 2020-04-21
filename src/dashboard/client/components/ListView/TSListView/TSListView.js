import React from "react";
import { List, Avatar, Skeleton, Button } from "antd";

const TSListView = ({ list, editHandler, deleteHandler, itemAvatar }) => (
  <List
    itemLayout="horizontal"
    dataSource={list}
    renderItem={item => (
      <List.Item
        actions={[
          <Button
            key="list-loadmore-edit"
            onClick={() => editHandler(item)}
          >
            Edit
          </Button>,
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
            avatar={<Avatar>{itemAvatar}</Avatar>}
            title={
              <a onClick={() => editHandler(item)}>
                {item.name ? item.name : item.id}
              </a>
            }
            description={`id: ${item.id}${item.name ? `, name: ${item.name}` : ""}, enable: ${item.enable ? true: false}`}
          />
        </Skeleton>
      </List.Item>
    )}
  />
);

export default TSListView;
