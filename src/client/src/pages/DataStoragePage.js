import React, { Component } from "react";
import { connect } from "react-redux";
import { Button, Form } from "antd";

import {
  requestDataStorage,
  requestUpdateDataStorage,
  requestTestDataStorageConnection,
} from "../actions";
import JSONView from "../components/JSONView";
import LayoutPage from "./LayoutPage";
import { getQuery, updateObjectByPath, deepCloneObject } from "../utils";
import ConnectionConfig from "../components/ConnectionConfig";
import { InteractionOutlined, SaveOutlined } from "@ant-design/icons";

class DataStoragePage extends Component {
  constructor(props) {
    super(props);
    this.state = {
      tempDataStorage: { connConfig: {} },
      connectionStatus: false,
      isDSChanged: false,
    };

    this.onDataStorageChange = this.onDataStorageChange.bind(this);
  }

  componentDidMount() {
    this.props.requestDataStorage();
    this.props.testConnection();
  }

  componentWillReceiveProps(newProps) {
    this.setState({
      tempDataStorage: deepCloneObject(newProps.dataStorage),
      connectionStatus: newProps.connectionStatus,
    });
  }

  onDataStorageChange(newDataStorage) {
    this.setState({
      tempDataStorage: newDataStorage,
      isDSChanged: true,
    });
  }

  onDataChange(dataPath, value) {
    this.setState((prevState) => {
      const newData = { ...prevState.tempDataStorage };
      // console.log(dataPath, value);
      updateObjectByPath(newData, dataPath, value);
      return { tempDataStorage: newData, isDSChanged: true };
    });
  }

  render() {
    const { tempDataStorage, connectionStatus, isDSChanged } = this.state;
    const { updateDataStorage, testConnection } = this.props;
    return (
      <LayoutPage
        pageTitle="Data Storage"
        pageSubTitle="Setup the default Data Storage configuration"
      >
        <p style={{ margin: 10 }}>
          Connection Status:{" "}
          <strong>
            {" "}
            {connectionStatus ? (
              <span style={{ color: "green" }}>Connected</span>
            ) : (
              <span style={{ color: "red" }}>Not Connected</span>
            )}{" "}
          </strong>
        </p>
        <Form
          labelCol={{
            span: 4,
          }}
          wrapperCol={{
            span: 14,
          }}
        >
          <ConnectionConfig
            defaultValue={tempDataStorage.connConfig}
            dataPath={"connConfig"}
            onDataChange={(dataPath, value) =>
              this.onDataChange(dataPath, value)
            }
            type="MONGODB"
          />
        </Form>
        <Button
          style={{ marginTop: "10px", marginRight: "10px" }}
          onClick={() => {
            if (isDSChanged) {
              updateDataStorage(tempDataStorage);
              this.setState({ isDSChanged: false });
              setTimeout(testConnection, 3000);
            } else {
              testConnection();
            }
          }}
          style={{ margin: 10 }}
        >
          <InteractionOutlined /> Test Connection
        </Button>
        <Button
          type="primary"
          onClick={() => {
            updateDataStorage(tempDataStorage);
            this.setState({ isDSChanged: false });
            setTimeout(testConnection, 3000);
          }}
          style={{ marginTop: "10px" }}
          disabled={this.state.isDSChanged ? false : true}
        >
          <SaveOutlined /> Save
        </Button>
      </LayoutPage>
    );
  }
}

const mapPropsToStates = ({ dataStorage }) => ({
  dataStorage: dataStorage.connConfig,
  connectionStatus: dataStorage.connectionStatus,
});

const mapDispatchToProps = (dispatch) => ({
  requestDataStorage: () => dispatch(requestDataStorage()),
  updateDataStorage: (newDataStorage) =>
    dispatch(requestUpdateDataStorage(newDataStorage)),
  testConnection: () => dispatch(requestTestDataStorageConnection()),
});

export default connect(mapPropsToStates, mapDispatchToProps)(DataStoragePage);
