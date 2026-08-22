import React from "react";
import { Button, Result } from "antd";

/**
 * Top-level crash guard. The previous implementation was imported from an
 * internal antd path (`antd/lib/alert/ErrorBoundary`) that no longer exists
 * in antd v5+/v6, so the dashboard now carries its own minimal boundary with
 * the same contract: catch render errors below the header and offer a reload.
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    const { error } = this.state;
    if (!error) {
      return this.props.children;
    }
    return (
      <Result
        status="error"
        title="Something went wrong"
        subTitle={String(error && error.message ? error.message : error)}
        extra={
          <Button type="primary" onClick={() => window.location.reload()}>
            Reload
          </Button>
        }
      />
    );
  }
}

export default ErrorBoundary;
