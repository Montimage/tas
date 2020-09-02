import React, { Component } from "react";
import { connect } from "react-redux";
import TSModal from "../TSModal";
import { addThing, deleteThing, showModal, selectDevice } from "../../actions";
import { Form, Button, Alert } from "antd";

import {
  FormTextItem,
  FormSelectItem,
  FormNumberItem,
  FormSwitchItem,
  FormCheckBoxItems
} from "../FormItems";
import ConnectionConfig from '../ConnectionConfig';
import { updateObjectByPath, deepCloneObject, isDataGenerator } from "../../utils";

class ThingModal extends Component {
  constructor(props) {
    super(props);
    const isDG = isDataGenerator();
    const initThing = {
      id: `dev-id-${Date.now()}`,
      name: `dev-name-${Date.now()}`,
      protocol: isDG ? "DATABASE":"MQTT",
      behaviours: [],
      timeToDown: 0,
      connConfig: {
        host: "localhost",
        port: !isDG ? 1883: 27017 ,
        options: null,
      },
      sensors: [],
      actuators: [],
      enable: true,
    };
    this.state = {
      data: props.selectedDevice ? deepCloneObject(props.selectedDevice) : initThing,
      error: null,
      isDG: isDataGenerator()
    };
  }

  // handleDelete() {
  //   let deleted = false;
  //   const { things, data, deleteThing } = this.props;
  //   for (let index = 0; index < things.length; index++) {
  //     const th = things[index];
  //     if (th.id === data.id) {
  //       deleteThing(data.id);
  //       deleted = true;
  //       break;
  //     }
  //   }

  //   if (!deleted) {
  //     this.setState(`Cannot delete thing ${data.id}: Not found!`);
  //   }
  // }

  handleOk() {
    // Validate data
    const { addThing, showModal, selectDevice } = this.props;
    const { data } = this.state;
    const newThing = { ...data };
    let errorMsg = null;
    if (newThing.connConfig.options) {
      try {
        const optionsValue = JSON.parse(newThing.connConfig.options);
        updateObjectByPath(newThing, "connConfig.options", optionsValue);
      } catch (error) {
        errorMsg =
          "Invalid option! The communication options must be in JSON format";
      }
    }
    if (errorMsg) {
      this.setState({ error: errorMsg });
    } else {
      addThing(data);
      showModal(null);
      selectDevice(null);
    }
  }

  handleCancel() {
    this.props.showModal(null);
    this.props.selectDevice(null);
  }

  handleDuplicate() {
    const { addThing, showModal, selectDevice } = this.props;
    const newThingID = `dev-id-${Date.now()}`;
    const newData = { ...this.state.data };
    updateObjectByPath(newData, "id", newThingID);
    updateObjectByPath(newData, "name", "New Device");
    addThing(newData);
    selectDevice(newData);
    setTimeout(() => {
      showModal("THING-FORM");
    }, 500);
    showModal(null);
  }

  onDataChange(dataPath, value) {
    this.setState((prevState) => {
      const newData = { ...prevState.data };
      // console.log(dataPath, value);
      updateObjectByPath(newData, dataPath, value);
      return { data: newData, error: null };
    });
  }

  render() {
    // this.onDataChange("connConfig.host","localhost");
    // this.onDataChange("name","NEW_NAME");
    const { data, error } = this.state;
    const { formID } = this.props;
    let footer = null;
    if (this.props.selectedDevice) {
      footer = [
        // <Button key="delete" type="danger" onClick={() => this.handleDelete()}>
        //   Delete
        // </Button>,
        <Button key="duplicate" onClick={() => this.handleDuplicate()}>
          Duplicate
        </Button>,
        <Button key="cancel" onClick={() => this.handleCancel()}>
          Cancel
        </Button>,
        <Button key="ok" type="primary" onClick={() => this.handleOk()}>
          OK
        </Button>,
      ];
    } else {
      footer = [
        <Button key="cancel" onClick={() => this.handleCancel()}>
          Cancel
        </Button>,
        <Button key="ok" type="primary" onClick={() => this.handleOk()}>
          OK
        </Button>,
      ];
    }

    return (
      <TSModal
        title={"Device"}
        visible={formID === "THING-FORM" ? true : false}
        onCancel={() => this.handleCancel()}
        footer={footer}
      >
        <Form
          labelCol={{
            span: 4,
          }}
          wrapperCol={{
            span: 14,
          }}
        >
          <FormTextItem
            label="Id"
            defaultValue={data.id}
            onChange={(v) => this.onDataChange("id", v)}
            helpText="The ID to identify this device"
            rules = {[
              {
                required: true,
                message: "Id is required!"
              }
            ]}
          />
          <FormTextItem
            label="Name"
            defaultValue={data.name}
            onChange={(v) => this.onDataChange("name", v)}
            helpText="The device's name"
          />
          <FormNumberItem
            label="Number of Instance"
            min={1}
            max={1000000}
            placeholder="Number of instances"
            defaultValue={data.scale ? data.scale : 1}
            onChange={(v) => this.onDataChange("scale", v)}
            helpText="Number of device with the same configuration. The id will be indexed automatically"
          />
          <FormCheckBoxItems
            label="Gateway Behaviours"
            defaultValue={data.behaviours ? data.behaviours : []}
            onChange={(v) => this.onDataChange('behaviours', v)}
            options={[
              "GATEWAY_DOWN"
            ]}
            helpText="Select the abnormal behaviours of the device"
          />
          {data.behaviours && data.behaviours.indexOf("GATEWAY_DOWN") > -1 && (
            <FormNumberItem
              label="Down Time (seconds)"
              min={1}
              max={65535}
              defaultValue={data.timeToDown ? data.timeToDown : 10}
              onChange={(v) => this.onDataChange('timeToDown', v)}
              helpText="The time before the gateway going to be failed!"
            />
          )}
          <span>Communication detail</span>
          <p />
          {!this.state.isDG ? (
            <React.Fragment>
              <FormSelectItem
                label="Protocol"
                defaultValue={data.protocol}
                onChange={(v) => this.onDataChange("protocol", v)}
                options={["MQTT", "STOMP"]}
                helpText="The communication protocol to connect with the other component to send and receive data."
              />
              <ConnectionConfig
                defaultValue={data.connConfig}
                dataPath={"connConfig"}
                onDataChange={(dataPath, value) =>
                  this.onDataChange(dataPath, value)
                }
                type={data.protocol}
              />
            </React.Fragment>
          ) : (
            <ConnectionConfig
              defaultValue={data.connConfig}
              dataPath={"connConfig"}
              onDataChange={(dataPath, value) =>
                this.onDataChange(dataPath, value)
              }
              type="MONGODB"
            />
          )}
          <FormSwitchItem
            label="Enable"
            onChange={(v) => this.onDataChange(`enable`, v)}
            checked={data.enable ? true : false}
            checkedChildren={"On"}
            unCheckedChildren={"Off"}
            helpText="Enable or disable this device and all of its children (sensors/actuators)"
          />
        </Form>
        {error && <Alert message={error} type="error" />}
      </TSModal>
    );
  }
}

const mapPropsToStates = ({ editingForm, model }) => ({
  formID: editingForm.formID,
  selectedDevice: editingForm.selectedDevice,
  things: model.things,
});

const mapDispatchToProps = (dispatch) => ({
  showModal: (modalID) => dispatch(showModal(modalID)),
  deleteThing: (thingID) => dispatch(deleteThing(thingID)),
  addThing: (thingData) => dispatch(addThing(thingData)),
  selectDevice: (thing) => dispatch(selectDevice(thing)),
});

export default connect(mapPropsToStates, mapDispatchToProps)(ThingModal);
