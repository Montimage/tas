import React, { Component } from "react";
import { connect } from "react-redux";
import { notification, Spin, Layout, Typography } from "antd";
import { resetNotification } from "../actions";
import describeError from "../describeError";
import TSFooter from "../components/TSFooter";
import "./styles.css";
const { Title, Text } = Typography;

const { Content } = Layout;

class LayoutPage extends Component {

  render() {
    const {
      requesting,
      notify,
      resetNotification,
      pageTitle,
      pageSubTitle,
    } = this.props;
    return (
      <Layout style={{backgroundColor: 'white'}}>
        {notify &&
          notification[notify.type]({
            message: notify.type.toUpperCase(),
            description: describeError(notify.message),
            onClose: () => resetNotification(),
          })}
        <Layout className="page-shell">
          <Content>
            {pageTitle && <Title level={2}>{pageTitle}</Title>}
            {pageSubTitle && <Text type="secondary">{pageSubTitle}</Text>}
            <div style={{ paddingTop: "30px" }} className="site-layout-content">
              {/* antd v5+ logs a console warning for `tip` on an unnested
                  Spin, so the label is rendered next to the spinner instead. */}
              {requesting ? (
                <div style={{ textAlign: "center", marginTop: 30 }}>
                  <Spin />
                  <div style={{ marginTop: 12 }}>Loading...</div>
                </div>
              ) : this.props.children}
              <TSFooter />
            </div>
          </Content>
        </Layout>
      </Layout>
    );
  }
}

const mapPropsToStates = ({ requesting, notify }) => ({
  notify,
  requesting,
});

const mapDispatchToProps = (dispatch) => ({
  resetNotification: () => dispatch(resetNotification()),
});

export default connect(mapPropsToStates, mapDispatchToProps)(LayoutPage);
