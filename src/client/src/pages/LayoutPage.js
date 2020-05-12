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
  constructor(props) {
    super(props);
    const {deployStatus} = props;
    let statusMessage = null;
    const isDG = isDataGenerator();
    if (deployStatus) {
      statusMessage = `${
        !isDG ? "Simulation" : "Data Generator"
      } is running. Model name ${deployStatus.model}. Started time: ${new Date(
        deployStatus.startedTime
      )}`;
    }
    this.state = {
      isDG,
      isLogPage: window.location.pathname.indexOf("/logs") > -1,
      statusMessage,
    }
  }

  componentWillReceiveProps(newProps) {
    const {deployStatus} = newProps;
    let statusMessage = null;
    if (deployStatus) {
      statusMessage = `${
        !this.state.isDG ? "Simulation" : "Data Generator"
      } is running. Model name ${deployStatus.model}. Started time: ${new Date(
        deployStatus.startedTime
      )}`;
    }
    this.setState({statusMessage});
  }

  componentDidMount() {
    this.props.requestDeployStatus(this.state.isDG);
    setInterval(() => {
      this.props.requestDeployStatus(this.state.isDG);
    }, 3000);
  }

  render() {
    const { isLogPage, statusMessage} = this.state;
    const { requesting, notify , resetNotification} = this.props;

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
