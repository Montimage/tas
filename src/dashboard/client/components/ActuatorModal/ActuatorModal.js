import React, { Component } from "react";
import { connect } from "react-redux";
import TSModal from "../TSModal";
import {
  addSimulationActuator,
  showModal,
  selectActuator
} from "../../actions";
import { Form, Button, Alert } from "antd";
import { updateObjectByPath, deepCloneObject } from "../../utils";
import {
  FormTextItem,
  FormSelectItem,
  FormNumberItem,
  FormSwitchItem
} from "../FormItems";

const initActuator = () => ({
  id: `act-id-${Date.now()}`,
  name: `act-name-${Date.now()}`,
  options: null,
  enable: true,
});

class ActuatorModal extends Component {
  constructor(props) {
    super(props);

    const { tool, model, selectedActuator } = props;
    const thingIDs = [];
    if (tool === "simulation" && model.things) {
      const { things } = model;
      for (let index = 0; index < things.length; index++) {
        thingIDs.push(things[index].id);
      }
    }

    this.state = {
      data: selectedActuator ? deepCloneObject(selectedActuator) : initActuator(),
      thingID: thingIDs[0],
      thingIDs,
      error: null
    };
  }

  componentWillReceiveProps(newProps) {
    const { tool, model, selectedActuator } = newProps;
    const thingIDs = [];
    if (tool === "simulation" && model.things) {
      const { things } = model;
      for (let index = 0; index < things.length; index++) {
        thingIDs.push(things[index].id);
      }
    }

    this.setState({
      data: selectedActuator ? deepCloneObject(selectedActuator) : initActuator(),
      thingID: thingIDs[0],
      thingIDs,
      error: null
    });
  }

  onThingChange(tID) {
    this.setState({ thingID: tID });
  }

  onDataChange(dataPath, value) {
    this.setState(prevState => {
      const newData = { ...prevState.data };
      updateObjectByPath(newData, dataPath, value);
      return { data: newData, error: null };
    });
  }

  // handleDelete() {
  //   const { thingID, data } = this.state;
  //   const {
  //     deleteSimulationActuator
  //   } = this.props;
  //   // Add sensor to a simulation model
  //   deleteSimulationActuator(data.id, thingID);
  //   this.props.showModal(null);
  // }

  handleOk() {
    const { thingID, data } = this.state;
    const {
      addSimulationActuator,
      showModal
    } = this.props;
    addSimulationActuator(thingID, data);
    showModal(null);
    this.props.selectActuator(null);
  }

  handleCancel() {
    this.props.showModal(null);
    this.props.selectActuator(null);
  }

  handleDuplicate() {
    const { thingID } = this.state;
    const {
      addSimulationActuator,
      showModal,
      selectActuator,
    } = this.props;
    const newActuatorID = `act-${Date.now()}`;
    const newData = { ...this.state.data, id: newActuatorID, name: 'New Actuator' };
    addSimulationActuator(thingID, newData);
    showModal(null);
    setTimeout(() => {
      selectActuator(newData);
      showModal('ACTUATOR-FORM');
    },300);
  }

  render() {
    const { data, error, thingID, thingIDs } = this.state;
    const { formID, tool } = this.props;
    let footer = null;

    if (this.props.selectedActuator) {
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
        title={"Actuator"}
        visible={formID==='ACTUATOR-FORM' && tool === 'simulation'}
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
          <FormSelectItem
            label="Thing"
            defaultValue={thingID}
            onChange={v => this.onThingChange(v)}
            options={thingIDs}
          />
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
          <FormTextItem
            label="Topic"
            defaultValue={data.options ? data.options.topic : null}
            onChange={v => this.onDataChange("options", { topic: v })}
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

const mapPropsToStates = ({ editingForm, model, tool }) => ({
  formID: editingForm.formID,
  selectedActuator: editingForm.selectedActuator,
  model,
  tool
});

const mapDispatchToProps = dispatch => ({
  showModal: modalID => dispatch(showModal(modalID)),
  selectActuator: act => dispatch(selectActuator(act)),
  addSimulationActuator: (thingID, data) =>
    dispatch(addSimulationActuator({ thingID, actuator: data })),
  // deleteSimulationActuator: (id, thingID) =>
  //   dispatch(deleteSimulationActuator({ thingID, actuatorID: id })),
});

export default connect(mapPropsToStates, mapDispatchToProps)(ActuatorModal);
