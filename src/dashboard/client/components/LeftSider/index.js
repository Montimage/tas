import React, { Component } from "react";
import { connect } from 'react-redux';

import { showModal } from '../../actions';
import { PartitionOutlined, BulbOutlined, BugOutlined } from '@ant-design/icons';

import TSSider from '../TSSider';

class LeftSider extends Component {
  render() {
    const { showModal } = this.props;
    const menuItems = [
      {
        key: 1,
        text: "Thing",
        action: () => showModal("NEW_THING_MODAL"),
        icon: <PartitionOutlined />
      },
      {
        key: 2,
        text: "Sensor",
        action: () => showModal("NEW_SENSOR_MODAL"),
        icon: <BugOutlined />
      },
      {
        key: 3,
        text: "Actuator",
        action: () => showModal("NEW_ACTUATOR_MODAL"),
        icon: <BulbOutlined />
      }
    ];
    return <TSSider rightSide={true} items={menuItems} theme="dark"/>;
  }
}

const mapDispatchToProps = dispatch => ({
  showModal: (mID) => dispatch(showModal(mID))
});

export default connect(
  null,
  mapDispatchToProps,
)(LeftSider);

