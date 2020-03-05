import React, { Component } from "react";
import { connect } from 'react-redux';

import { setViewType } from '../../actions';

import TSSider from '../TSSider';
import { UnorderedListOutlined, ForkOutlined, FilterOutlined } from "@ant-design/icons";
import './style.css';

class RightSider extends Component {
  render() {
    const { setViewType } = this.props;
    const menuItems = [
      {
        key: 5,
        text: "JSON View",
        action: () => setViewType('json'),
        icon: <FilterOutlined />
      },
      {
        key: 6,
        text: "Graph View",
        action: () => setViewType('graph'),
        icon: <ForkOutlined />
      },
      {
        key: 7,
        text: "List View",
        action: () => setViewType('list'),
        icon: <UnorderedListOutlined />
      }
    ];
    return <TSSider className="right-sider" rightSide={false} items={menuItems} defaultKey={5} theme="light" />;
  }
}

const mapDispatchToProps = dispatch => ({
  setViewType: (mID) => dispatch(setViewType(mID))
});

export default connect(
  null,
  mapDispatchToProps,
)(RightSider);