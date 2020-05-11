import React, { Component } from "react";
import { connect } from "react-redux";
import { notification, Spin, Alert, Layout } from "antd";
import { resetNotification, requestDeployStatus } from "../actions";
import { isDataGenerator } from "../utils";
import LeftSider from "../components/LeftSider";
import RightSider from "../components/RightSider";
import "./styles.css";

const { Content } = Layout;

class LayoutPage extends Component {
  componentDidMount() {
    const isDG = isDataGenerator();
    this.props.requestDeployStatus(isDG);
    setInterval(() => {
      this.props.requestDeployStatus(isDG);
    }, 3000);
  }

  render() {
    const isDG = isDataGenerator();
    const isLogPage = window.location.pathname.indexOf("/logs") > -1;
    const { requesting, deployStatus, notify , resetNotification} = this.props;

    let statusMessage = null;
    if (deployStatus) {
      statusMessage = `${
        !isDG ? "Simulation" : "Data Generator"
      } is running. Model name ${deployStatus.model}. Started time: ${new Date(
        deployStatus.startedTime
      )}`;
    }

    return (
      <Layout>
        {!isLogPage && <LeftSider />}

        {notify &&
          notification[notify.type]({
            message: notify.type.toUpperCase(),
            description:
              typeof notify.message === "object"
                ? JSON.stringify(notify.message)
                : notify.message,
            onClose: () => resetNotification(),
          })}

        <Layout style={{ padding: "0 24px 24px" }}>
          <Content>
            {statusMessage && (
              <Alert
                message={statusMessage}
                type="info"
                style={{ marginBottom: "10px", marginTop: "20px" }}
                showIcon
              />
            )}
            {requesting ? <Spin tip="Loading..." /> : this.props.children}
          </Content>
        </Layout>
        {!isLogPage && <RightSider />}
      </Layout>
    );
  }
}

const mapPropsToStates = ({ requesting, notify, deployStatus }) => ({
  notify,
  requesting,
  deployStatus,
});

const mapDispatchToProps = (dispatch) => ({
  requestDeployStatus: (isDG) => dispatch(requestDeployStatus(isDG)),
  resetNotification: () => dispatch(resetNotification()),
});

export default connect(mapPropsToStates, mapDispatchToProps)(LayoutPage);
