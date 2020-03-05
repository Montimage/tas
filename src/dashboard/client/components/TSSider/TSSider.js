import React from "react";
import { Layout, Menu } from "antd";
const { Sider } = Layout;

import "./styles.css";

const TSSider = ({ defaultKey, items, rightSide, theme }) => (
  <Sider
    className="side-background-color"
    breakpoint="lg"
    collapsedWidth="0"
  >
    <Menu
      mode="inline"
      theme={theme ? theme : "light"}
      style={
        rightSide
          ? { height: "100%", borderRight: 0 }
          : { height: "100%", borderLeft: 10 }
      }
      defaultSelectedKeys={[`${defaultKey}`]}
      defaultOpenKeys={[`sub${defaultKey}`]}
    >
      {items.map(i => (
        <Menu.Item key={i.key} onClick={i.action}>
          {i.icon}
          {i.text}
        </Menu.Item>
      ))}
    </Menu>
  </Sider>
);

export default TSSider;
