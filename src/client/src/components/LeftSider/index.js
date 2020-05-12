import React, { Component } from "react";
import { connect } from "react-redux";

import { showModal } from "../../actions";
import {
  PartitionOutlined,
  BulbOutlined,
  BugOutlined,
} from "@ant-design/icons";

import TSSider from "../TSSider";

class LeftSider extends Component {
  render() {
    const { showModal } = this.props;

    const menuItems = [
      {
        key: 3,
        text: "Add Device",
        action: () => showModal("THING-FORM"),
        icon: <PartitionOutlined />
      },
      {
        key: 1,
        text: "Add Sensor",
        action: () => showModal("SENSOR-FORM"),
        icon: <BugOutlined />
      },
      {
        key: 2,
        text: "Add Actuator",
        action: () => showModal("ACTUATOR-FORM"),
        icon: <BulbOutlined />
      }
      // ,
      // {
      //   key: 4,
      //   text: "Connection",
      //   action: () => showModal("CONNECTION-FORM"),
      //   icon: <BulbOutlined />
      // }
    ];

    return <TSSider rightSide={true} items={menuItems} theme="dark" />;
  }
}

const mapDispatchToProps = dispatch => ({
  showModal: mID => dispatch(showModal(mID))
});

export default connect(null, mapDispatchToProps)(LeftSider);
