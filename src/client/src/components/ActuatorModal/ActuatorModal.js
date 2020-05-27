import React, { Component } from "react";
import { connect } from "react-redux";
import TSModal from "../TSModal";
import {
  addSimulationActuator,
  showModal,
  selectActuator,
} from "../../actions";
import { Form, Button, Alert } from "antd";
import {
  updateObjectByPath,
  deepCloneObject,
  isDataGenerator,
} from "../../utils";
import {
  FormTextItem,
  FormSelectItem,
  FormNumberItem,
  FormSwitchItem,
  FormEditableTextItem,
} from "../FormItems";

const initActuator = () => ({
  id: `act-id-${Date.now()}`,
  objectId: null,
  name: `act-name-${Date.now()}`,
  topic: null,
  enable: true,
});

class ActuatorModal extends Component {
  constructor(props) {
    super(props);

    const { model, selectedActuator } = props;
    const thingIDs = [null];
    let thingID = null;
    if (model.things) {
      const { things } = model;
      for (let index = 0; index < things.length; index++) {
        thingIDs.push(things[index].id);
        if (selectedActuator !== null && thingID === null) {
          const { actuators } = things[index];
          for (let aid = 0; aid < actuators.length; aid++) {
            if (actuators[aid].id === selectedActuator.id) {
              thingID = things[index].id;
              break;
            }
          }
        }
      }
    }

    this.state = {
      data: selectedActuator
        ? deepCloneObject(selectedActuator)
        : initActuator(),
      thingID: thingID ? thingID : thingIDs[1],
      thingIDs,
      error: null,
    };
  }

  componentWillReceiveProps(newProps) {
    const { model, selectedActuator } = newProps;
    const thingIDs = [null];
    let thingID = null;
    if (model.things) {
      const { things } = model;
      for (let index = 0; index < things.length; index++) {
        thingIDs.push(things[index].id);
        if (selectedActuator !== null && thingID === null) {
          const { actuators } = things[index];
          for (let aid = 0; aid < actuators.length; aid++) {
            if (actuators[aid].id === selectedActuator.id) {
              thingID = things[index].id;
              break;
            }
          }
        }
      }
    }

    this.setState({
      data: selectedActuator
        ? deepCloneObject(selectedActuator)
        : initActuator(),
      thingID: thingID ? thingID : thingIDs[1],
      thingIDs,
      error: null,
    });
  }

  onThingChange(tID) {
    this.setState({ thingID: tID });
  }

  onDataChange(dataPath, value) {
    this.setState((prevState) => {
      const newData = { ...prevState.data };
      updateObjectByPath(newData, dataPath, value);
      return { data: newData, error: null };
    });
  }

  handleOk() {
    const { thingID, data } = this.state;
    const { addSimulationActuator, showModal } = this.props;
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
    const { addSimulationActuator, showModal, selectActuator } = this.props;
    const newActuatorID = `act-${Date.now()}`;
    const newData = {
      ...this.state.data,
      id: newActuatorID,
      objectId: this.state.objectId,
      name: "New Actuator",
    };
    addSimulationActuator(thingID, newData);
    showModal(null);
    setTimeout(() => {
      selectActuator(newData);
      showModal("ACTUATOR-FORM");
    }, 300);
  }

  render() {
    const { data, error, thingID, thingIDs } = this.state;
    const { formID } = this.props;
    let footer = null;

    if (this.props.selectedActuator) {
      footer = [
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

    const topic = data.topic
      ? data.topic
      : `things/${thingID}/actuators${
          data.objectId ? `/${data.objectId}` : ""
        }/${data.id}/#`;
    const isDG = isDataGenerator();
    return (
      <TSModal
        title={"Actuator"}
        visible={formID === "ACTUATOR-FORM" && !isDG}
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
          <FormSelectItem
            label="Device"
            defaultValue={thingID}
            onChange={(v) => this.onThingChange(v)}
            options={thingIDs}
            helpText="The identify of the device which this actuator will connect to"
          />
          <FormTextItem
            label="Id"
            defaultValue={data.id}
            onChange={(v) => this.onDataChange("id", v)}
            helpText="The identify of the actuator"
            rules = {[
              {
                required: true,
                message: "Id is required!"
              }
            ]}
          />
          <FormTextItem
            label="Object Id"
            defaultValue={data.objectId}
            onChange={(v) => this.onDataChange("objectId", v)}
            placeholder="Identify of device type (IP Smart Object Format)"
            helpText="The identify of the device type based on IPSO format. For example 3313 - for temperature"
          />
          <FormTextItem
            label="Name"
            defaultValue={data.name}
            onChange={(v) => this.onDataChange("name", v)}
            helpText="The actuator's name"
          />
          <FormNumberItem
            label="Number of Instance"
            min={1}
            max={1000000}
            placeholder="Number of instances"
            defaultValue={data.scale ? data.scale : 1}
            onChange={(v) => this.onDataChange("scale", v)}
            helpText="The number of actuators with the same configuration. The id of the generated actuator will be indexed automatically"
          />
          <FormEditableTextItem
            label="Topic"
            defaultValue={topic}
            onChange={(v) => this.onDataChange("topic", v)}
            helpText="The MQTT/STOMP topic on which the actuator will be listening to receive actuated data"
          />
          <FormSwitchItem
            label="Enable"
            onChange={(v) => this.onDataChange(`enable`, v)}
            checked={data.enable ? true : false}
            checkedChildren={"On"}
            unCheckedChildren={"Off"}
            helpText="Enable or disable this actuator from the simulation"
          />
        </Form>
        {error && <Alert message={error} type="error" />}
      </TSModal>
    );
  }
}

const mapPropsToStates = ({ editingForm, model }) => ({
  formID: editingForm.formID,
  selectedActuator: editingForm.selectedActuator,
  model,
});

const mapDispatchToProps = (dispatch) => ({
  showModal: (modalID) => dispatch(showModal(modalID)),
  selectActuator: (act) => dispatch(selectActuator(act)),
  addSimulationActuator: (thingID, data) =>
    dispatch(addSimulationActuator({ thingID, actuator: data })),
});

export default connect(mapPropsToStates, mapDispatchToProps)(ActuatorModal);
