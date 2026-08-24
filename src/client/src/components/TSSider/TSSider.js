import React from "react";
import { Link } from "react-router-dom";
import { Layout, Menu } from "antd";
import { MenuOutlined } from "@ant-design/icons";

import "./styles.css";

const { Sider } = Layout;

/* The responsive Sider's collapse control is icon-only; without a name it is
   announced as an unlabelled button (issue #39). A labelled button replaces
   antd's default trigger content. */
const siderTrigger = (
  <button
    type="button"
    aria-label="Collapse or expand navigation"
    style={{
      width: "100%",
      height: 48,
      background: "#fff",
      border: 0,
      cursor: "pointer",
    }}
  >
    <MenuOutlined />
  </button>
);

const TSSider = ({ defaultKey, items, rightSide, theme }) => (
  <Sider
    className="side-background-color"
    breakpoint="lg"
    collapsedWidth="0"
    trigger={siderTrigger}
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
      items={items.map((i) => ({
        key: i.key,
        icon: i.icon,
        label: i.href ? (
          <Link to={i.href}>{i.text}</Link>
        ) : (
          i.text
        ),
        onClick: i.action,
      }))}
    />
  </Sider>
);

export default TSSider;
