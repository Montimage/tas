import React, { Component } from "react";

import { getQuery } from "../../utils";
import TSSider from "../TSSider";
import {
  UnorderedListOutlined,
  ForkOutlined,
  FilterOutlined,
} from "@ant-design/icons";
import "./style.css";

class RightSider extends Component {
  render() {
    const menuItems = [
      {
        key: 7,
        text: "List View",
        href: '?view=list',
        icon: <UnorderedListOutlined />,
      },
      {
        key: 5,
        text: "JSON View",
        href: '?view=json',
        icon: <FilterOutlined />,
      },
      {
        key: 6,
        text: "Graph View",
        href: '?view=graph',
        icon: <ForkOutlined />,
      },
    ];
    let dKey = 7;
    const viewType = getQuery("view");
    if (viewType) {
      switch (viewType) {
        case "list":
          dKey = 7;
          break;
        case "json":
          dKey = 5;
          break;
        case "graph":
          dKey = 6;
          break;
        default:
          break;
      }
    }
    return (
      <TSSider
        className="right-sider"
        rightSide={false}
        items={menuItems}
        defaultKey={dKey}
        theme="light"
      />
    );
  }
}
export default RightSider;
