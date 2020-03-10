import React, { Component } from "react";
import { connect } from "react-redux";
import TSModal from "../TSModal";
import { addThing, deleteThing, showModal } from "../../actions";
import { Form, Button, Alert } from "antd";

import { FormTextItem, FormSelectItem, FormNumberItem, FormSwitchItem } from "../FormItems";
import { updateObjectByPath } from "../../utils";

class ThingModal extends Component {
  constructor(props) {
    super(props);
    const initThing = {
      id: `thing-id-${Date.now()}`,
      name: `thing-name-${Date.now()}`,
      protocol: "mqtt",
      commConfig: {
        host: "localhost",
        port: 1883,
        options: null
      },
      sensors: [],
      actuators: [],
      enable: true
    };
    this.state = {
      data: props.selectedThing ? props.selectedThing : initThing,
      error: null
    };
  }

  handleDelete() {
    let deleted = false;
    const { things, data, deleteThing } = this.props;
    for (let index = 0; index < things.length; index++) {
      const th = things[index];
      if (th.id === data.id) {
        deleteThing(data.id);
        deleted = true;
        break;
      }
    }

    if (!deleted) {
      this.setState(`Cannot delete thing ${data.id}: Not found!`);
    }
  }

  handleOk() {
    // Validate data
    const { addThing, showModal } = this.props;
    const { data } = this.state;
    const newThing = { ...data };
    let errorMsg = null;
    if (newThing.commConfig.options) {
      try {
        const optionsValue = JSON.parse(newThing.commConfig.options);
        updateObjectByPath(newThing, "commConfig.options", optionsValue);
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
    }
  }

  handleCancel() {
    this.props.showModal(null);
  }

  handleDuplicate() {
    const newThingID = `thing-${Date.now()}`;
    this.setState(prevState => ({
      data: { ...prevState.data, id: newThingID }
    }));
  }

  onDataChange(dataPath, value) {
    this.setState(prevState => {
      const newData = { ...prevState.data };
      updateObjectByPath(newData, dataPath, value);
      return { data: newData, error: null };
    });
  }

  render() {
    const { data, error } = this.state;
    const { formID } = this.props;
    let footer = null;
    if (this.props.selectedThing) {
      footer = [
        <Button key="delete" type="danger" onClick={() => this.handleDelete()}>
          Delete
        </Button>,
        <Button key="duplicate" onClick={() => this.handleDuplicate()}>
          Duplicate
        </Button>,
        <Button key="cancel" onClick={() => this.handleCancel()}>
          Cancel
        </Button>,
        <Button key="ok" type="primary" onClick={() => this.handleOk()}>
          OK
        </Button>
      ];
    } else {
      footer = [
        <Button key="cancel" onClick={() => this.handleCancel()}>
          Cancel
        </Button>,
        <Button key="ok" type="primary" onClick={() => this.handleOk()}>
          OK
        </Button>
      ];
    }

    return (
      <TSModal
        title="Thing"
        visible={formID === "THING-FORM" ? true : false}
        onCancel={() => this.handleCancel()}
        footer={footer}
      >
        <Form
          labelCol={{
            span: 4
          }}
          wrapperCol={{
            span: 14
          }}
        >
          <FormTextItem
            label="Id"
            defaultValue={data.id}
            onChange={v => this.onDataChange("id", v)}
          />
          <FormTextItem
            label="Name"
            defaultValue={data.name}
            onChange={v => this.onDataChange("name", v)}
          />
          <FormNumberItem
            label="Scale"
            min={1}
            max={1000000}
            placeholder="Number of instances"
            defaultValue={data.scale}
            onChange={v => this.onDataChange("scale", v)}
          />
          <FormSelectItem
            label="Protocol"
            defaultValue={data.protocol}
            onChange={v => this.onDataChange("protocol", v)}
            options={["MQTT", "STOMP"]}
          />
          <span>Communication detail</span>
          <p />
          <FormTextItem
            label="Host"
            defaultValue={data.commConfig.host}
            onChange={v => this.onDataChange("commConfig.host", v)}
          />
          <FormNumberItem
            label="Port"
            min={1023}
            max={65535}
            defaultValue={data.commConfig.port}
            onChange={v => this.onDataChange("commConfig.port", v)}
          />
          <FormTextItem
            label="Options"
            defaultValue={data.commConfig.options}
            onChange={v => this.onDataChange("commConfig.options", v)}
          />
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
  things: model.things
});

const mapDispatchToProps = dispatch => ({
  showModal: modalID => dispatch(showModal(modalID)),
  deleteThing: thingID => dispatch(deleteThing(thingID)),
  addThing: thingData => dispatch(addThing(thingData))
});

export default connect(mapPropsToStates, mapDispatchToProps)(ThingModal);
