import React, { Component } from "react";
import { connect } from "react-redux";
import TSModal from "../TSModal";
import { updateDataStorage, showModal } from "../../actions";
import { Form, Button, Alert } from "antd";
import { updateObjectByPath } from "../../utils";
import ConnectionConfig from "../ConnectionConfig";

const initData = {
  host: "localhost",
  port: 27017,
  user: null,
  password: null,
  options: null
};

class ConnectionConfigModal extends Component {
  constructor(props) {
    super(props);

    this.state = {
      data: props.dbConfig ? props.dbConfig : initData,
      error: null
    };
  }

  componentWillReceiveProps(newProps) {
    this.setState({
      data: newProps.dbConfig
        ? newProps.dbConfig
        : initData,
      error: null
    });
  }

  onDataChange(dataPath, value) {
    this.setState(prevState => {
      const newData = { ...prevState.data };
      updateObjectByPath(newData, dataPath, value);
      return { data: newData, error: null };
    });
  }

  handleOk() {
    const { data } = this.state;
    const { updateDataStorage } = this.props;
    updateDataStorage(data);
    this.props.showModal(null);
  }

  handleCancel() {
    this.props.showModal(null);
  }

  render() {
    const { data, error } = this.state;
    const { formID, tool } = this.props;

    return (
      <TSModal
        title={"Data Storage"}
        visible={formID === "DATA-STORAGE-FORM" && tool === "data-generator"}
        onCancel={() => this.handleCancel()}
        footer={[
          <Button key="cancel" onClick={() => this.handleCancel()}>
            Cancel
          </Button>,
          <Button key="ok" type="primary" onClick={() => this.handleOk()}>
            OK
          </Button>
        ]}
      >
        <Form
          labelCol={{
            span: 4
          }}
          wrapperCol={{
            span: 14
          }}
        >
          <ConnectionConfig
            defaultValue={data}
            dataPath={""}
            onDataChange={(dataPath, value) =>
              this.onDataChange(dataPath, value)
            }
            type="MONGODB"
          />
        </Form>
        {error && <Alert message={error} type="error" />}
      </TSModal>
    );
  }
}

const mapPropsToStates = ({ editingForm, model, tool }) => ({
  formID: editingForm.formID,
  dbConfig: model.dbConfig,
  tool
});

const mapDispatchToProps = dispatch => ({
  showModal: modalID => dispatch(showModal(modalID)),
  updateDataStorage: data => dispatch(updateDataStorage(data))
});

export default connect(mapPropsToStates, mapDispatchToProps)(ConnectionConfigModal);
