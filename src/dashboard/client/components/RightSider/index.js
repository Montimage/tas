import React, { Component } from "react";
import { connect } from 'react-redux';

import { setView } from '../../actions';

import TSSider from '../TSSider';
import { UnorderedListOutlined, ForkOutlined, FilterOutlined } from "@ant-design/icons";
import './style.css';

class RightSider extends Component {
  render() {
    const { setView } = this.props;
    const menuItems = [
      {
        key: 5,
        text: "JSON View",
        action: () => setView('json'),
        icon: <FilterOutlined />
      },
      {
        key: 6,
        text: "Graph View",
        action: () => setView('graph'),
        icon: <ForkOutlined />
      },
      {
        key: 7,
        text: "List View",
        action: () => setView('list'),
        icon: <UnorderedListOutlined />
      }
    ];
    return <TSSider className="right-sider" rightSide={false} items={menuItems} defaultKey={5} theme="light" />;
  }
}

const mapDispatchToProps = dispatch => ({
  setView: (mID) => dispatch(setView(mID))
});

export default connect(
  null,
  mapDispatchToProps,
)(RightSider);