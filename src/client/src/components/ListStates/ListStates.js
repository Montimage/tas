import React from "react";
import { Button, Empty } from "antd";

/**
 * Shared list-view states. Every list page renders these through its antd
 * Table `locale.emptyText` slot so a genuinely empty table is
 * distinguishable from one still loading (the LayoutPage spinner owns the
 * in-flight case) and a failed request offers a retry.
 */

export const ListStateEmpty = ({ description, action }) => (
  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={description}>
    {action}
  </Empty>
);

export const ListStateError = ({ message, onRetry }) => (
  <Empty
    image={Empty.PRESENTED_IMAGE_SIMPLE}
    description={
      <span>
        Failed to load: {message === null || message === undefined ? "request failed" : String(message)}
      </span>
    }
  >
    <Button type="primary" onClick={onRetry}>
      Retry
    </Button>
  </Empty>
);
