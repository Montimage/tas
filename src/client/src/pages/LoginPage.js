import React, { Component } from "react";
import { Card, Layout, Typography } from "antd";

import LoginForm from "../components/LoginForm";
import "./styles.css";

const { Content } = Layout;
const { Title, Text } = Typography;

/**
 * The whole page when there is no session.
 *
 * Shown instead of the routed content, not on a route of its own: the address
 * the operator asked for is worth keeping, so that signing in leaves them on
 * the page they were trying to reach rather than on the dashboard's front page.
 */
class LoginPage extends Component {
  render() {
    return (
      <Layout style={{ backgroundColor: "white" }}>
        <Content
          style={{
            display: "flex",
            justifyContent: "center",
            padding: "60px 20px",
          }}
        >
          <Card style={{ width: "100%", maxWidth: "420px" }}>
            <Title level={3}>Sign in</Title>
            <Text type="secondary">
              The Testing as a Service API is only served to a signed-in
              operator.
            </Text>
            <div style={{ paddingTop: "24px" }}>
              <LoginForm />
            </div>
          </Card>
        </Content>
      </Layout>
    );
  }
}

export default LoginPage;
