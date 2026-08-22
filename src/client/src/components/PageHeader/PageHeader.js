import React from "react";
import { Typography } from "antd";

const { Title } = Typography;

/**
 * Minimal stand-in for antd's removed `PageHeader` component (dropped from
 * antd v5). Covers the subset this dashboard used: title, optional subTitle
 * and the header look, without pulling in @ant-design/pro-components.
 */
const PageHeader = ({ title, subTitle }) => (
  <div style={{ marginBottom: 16 }}>
    <Title level={4} style={{ marginBottom: 0 }}>
      {title}
    </Title>
    {subTitle ? (
      <Typography.Text type="secondary">{subTitle}</Typography.Text>
    ) : null}
  </div>
);

export default PageHeader;
