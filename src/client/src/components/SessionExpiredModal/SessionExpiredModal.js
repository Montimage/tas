import React, { Component } from "react";
import { connect } from "react-redux";
import { Modal, Typography } from "antd";

import LoginForm from "../LoginForm";

const { Paragraph } = Typography;

/**
 * Sign in again without leaving the page.
 *
 * When a session runs out in the middle of a workflow the obvious reaction -
 * send the browser to a login screen - throws away whatever the operator had
 * typed and not yet saved. So this is a modal laid over the current page
 * instead: the view underneath stays mounted, with its form state intact, and
 * comes back exactly as it was once the new session is established.
 */
class SessionExpiredModal extends Component {
  render() {
    const { authenticated, sessionExpired } = this.props;
    return (
      <Modal
        title="Your session has expired"
        visible={sessionExpired && !authenticated}
        footer={null}
        closable={false}
        maskClosable={false}
        keyboard={false}
        destroyOnClose
      >
        <Paragraph>
          Sign in again to carry on. Nothing on the page behind this window has
          been lost - anything you were editing is still there.
        </Paragraph>
        <LoginForm />
      </Modal>
    );
  }
}

const mapPropsToStates = ({ auth }) => ({
  authenticated: auth.authenticated,
  sessionExpired: auth.sessionExpired,
});

export default connect(mapPropsToStates)(SessionExpiredModal);
