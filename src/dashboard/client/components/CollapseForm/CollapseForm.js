import React from "react";
import { Collapse } from "antd";

const { Panel } = Collapse;

const CollapseForm = ({ title, children, bordered = true }) => (
  <Collapse accordion style={{margin: '10px'}} defaultActiveKey={['1']} bordered={bordered}>
    <Panel header={title} key="1">
      {children}
    </Panel>
  </Collapse>
);

export default CollapseForm;
