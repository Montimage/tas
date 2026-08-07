import React, { Component } from "react";
import { connect } from "react-redux";
import { Alert, Button, Form, Input } from "antd";
import { LockOutlined, UserOutlined } from "@ant-design/icons";

import { login } from "../../actions";

/**
 * Turn what the API threw into something worth reading.
 *
 * The api layer throws the server's own message, which is right for a wrong
 * password ("Invalid credentials") but unhelpful for the two failures an
 * operator can only fix outside the browser: a server with no credential
 * configured at all, and a login attempt that tripped the rate limit. Both are
 * recognised by the message the server sends (see `src/server/app.js` and
 * `src/server/routes/auth.js`) and answered with what to do about it.
 *
 * @param {*} error The value thrown by the api layer, normally a string
 * @returns {String|null} The message to show, or null when there is none
 */
const describeError = (error) => {
  if (!error) return null;
  const message = typeof error === "string" ? error : String(error);
  if (message.indexOf("Authentication is not configured") !== -1) {
    return "This server has no administrator credential configured, so nobody can sign in yet. Set AUTH_ADMIN_USERNAME and AUTH_ADMIN_PASSWORD_HASH (see the README) and restart it.";
  }
  if (message.indexOf("Too many login attempts") !== -1) {
    return "Too many failed sign-in attempts from this address. Wait a few minutes and try again.";
  }
  return message;
};

class LoginForm extends Component {
  render() {
    const { loggingIn, error, login } = this.props;
    const description = describeError(error);
    return (
      <Form
        layout="vertical"
        onFinish={(values) =>
          login({ username: values.username, password: values.password })
        }
      >
        {description && (
          <Form.Item>
            <Alert type="error" message={description} showIcon />
          </Form.Item>
        )}
        <Form.Item
          label="Username"
          name="username"
          rules={[{ required: true, message: "Please enter your username" }]}
        >
          <Input prefix={<UserOutlined />} autoComplete="username" />
        </Form.Item>
        <Form.Item
          label="Password"
          name="password"
          rules={[{ required: true, message: "Please enter your password" }]}
        >
          <Input.Password
            prefix={<LockOutlined />}
            autoComplete="current-password"
          />
        </Form.Item>
        <Form.Item style={{ marginBottom: 0 }}>
          <Button type="primary" htmlType="submit" loading={loggingIn} block>
            Sign in
          </Button>
        </Form.Item>
      </Form>
    );
  }
}

const mapPropsToStates = ({ auth }) => ({
  loggingIn: auth.loggingIn,
  error: auth.error,
});

const mapDispatchToProps = (dispatch) => ({
  login: ({ username, password }) => dispatch(login({ username, password })),
});

export default connect(mapPropsToStates, mapDispatchToProps)(LoginForm);
