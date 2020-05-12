import React, { Component } from "react";
import { connect } from "react-redux";
import TSModal from "../TSModal";
import { addThing, deleteThing, showModal, selectThing } from "../../actions";
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
      id: `thing-id-${Date.now()}`,
      name: `thing-name-${Date.now()}`,
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
      data: props.selectedThing ? deepCloneObject(props.selectedThing) : initThing,
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
    const { addThing, showModal, selectThing } = this.props;
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
      selectThing(null);
    }
  }

  handleCancel() {
    this.props.showModal(null);
    this.props.selectThing(null);
  }

  handleDuplicate() {
    const { addThing, showModal, selectThing } = this.props;
    const newThingID = `thing-${Date.now()}`;
    const newData = { ...this.state.data };
    updateObjectByPath(newData, "id", newThingID);
    updateObjectByPath(newData, "name", "New Thing");
    addThing(newData);
    selectThing(newData);
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
    if (this.props.selectedThing) {
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
        title={"Thing"}
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
          />
          <FormTextItem
            label="Name"
            defaultValue={data.name}
            onChange={(v) => this.onDataChange("name", v)}
          />
          <FormNumberItem
            label="Scale"
            min={1}
            max={1000000}
            placeholder="Number of instances"
            defaultValue={data.scale}
            onChange={(v) => this.onDataChange("scale", v)}
          />
          <FormCheckBoxItems
            label="Gateway Behaviours"
            defaultValue={data.behaviours ? data.behaviours : []}
            onChange={(v) => this.onDataChange('behaviours', v)}
            options={[
              "GATEWAY_DOWN"
            ]}
          />
          {data.behaviours && data.behaviours.indexOf("GATEWAY_DOWN") > -1 && (
            <FormNumberItem
              label="Time Before Down"
              min={1}
              max={65535}
              defaultValue={data.timeToDown ? data.timeToDown : 10}
              onChange={(v) => this.onDataChange('timeToDown', v)}
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
          />
        </Form>
        {error && <Alert message={error} type="error" />}
      </TSModal>
    );
  }
}

const mapPropsToStates = ({ editingForm, model }) => ({
  formID: editingForm.formID,
  selectedThing: editingForm.selectedThing,
  things: model.things,
});

const mapDispatchToProps = (dispatch) => ({
  showModal: (modalID) => dispatch(showModal(modalID)),
  deleteThing: (thingID) => dispatch(deleteThing(thingID)),
  addThing: (thingData) => dispatch(addThing(thingData)),
  selectThing: (thing) => dispatch(selectThing(thing)),
});

export default connect(mapPropsToStates, mapDispatchToProps)(ThingModal);
