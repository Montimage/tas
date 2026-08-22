import React from "react";
import { Collapse } from "antd";

const CollapseForm = ({ title, children, bordered = true, active, extra = null }) => (
  <Collapse
    accordion
    style={{ margin: "10px" }}
    defaultActiveKey={active ? ["1"] : null}
    bordered={bordered}
    items={[
      {
        key: "1",
        label: title,
        extra: extra,
        children: children,
      },
    ]}
  />
);

export default CollapseForm;
