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
            size="small"
            onClick={() => editHandler(item)}
          >
            Edit
          </Button>,
          <Button
            key="list-loadmore-edit"
            size="small"
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
            title={<a href="https://ant.design">{item.name ? item.name : item.id}</a>}
            description="Ant Design, a design language for background applications, is refined by Ant UED Team"
          />
        </Skeleton>
      </List.Item>
    )}
  />
);

export default TSListView;
