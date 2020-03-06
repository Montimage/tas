import React, { Component } from "react";
import { connect } from 'react-redux';

import { showModal } from '../../actions';
import { PartitionOutlined, BulbOutlined, BugOutlined, DatabaseOutlined } from '@ant-design/icons';

import TSSider from '../TSSider';

class LeftSider extends Component {
  render() {
    const { showModal, tool } = this.props;

    const menuItems = [
      {
        key: 1,
        text: "Sensor",
        action: () => showModal("SENSOR-FORM"),
        icon: <BugOutlined />
      },
      {
        key: 2,
        text: "Actuator",
        action: () => showModal("ACTUATOR-FORM"),
        icon: <BulbOutlined />
      }
    ];

    if (tool === 'simulation') {
      menuItems.push({
        key: 3,
        text: "Thing",
        action: () => showModal("THING-FORM"),
        icon: <PartitionOutlined />
      });
    } else {
      menuItems.push({
        key: 3,
        text: "Data Storage",
        action: () => showModal("DATA-STORAGE-FORM"),
        icon: <DatabaseOutlined />
      });
    }
    return (
      <TSSider rightSide={true} items={menuItems} theme="dark" />
    );
  }
}

const mapPropsToStates = ({ tool}) => ({
  tool
});

const mapDispatchToProps = dispatch => ({
  showModal: (mID) => dispatch(showModal(mID))
});

export default connect(
  mapPropsToStates,
  mapDispatchToProps,
)(LeftSider);

