import React, { Component } from "react";
import { connect } from "react-redux";
import TSModal from "../TSModal";
import {
  addSimulationActuator,
  showModal,
  selectActuator,
} from "../../actions";
import { Form, Button } from "antd";
import {
  updateObjectByPath,
} from "../../utils";
import {
  FormTextNotEditableItem,
  FormNumberItem,
  FormSwitchItem,
  FormEditableTextItem,
} from "../FormItems";

class ActuatorModal extends Component {
  constructor(props) {
    super(props);
    const { actuatorData } = props;
    this.state = {
      actuatorData,
      isChanged: false
    };
  }

  onDataChange(dataPath, value) {
    this.setState((prevState) => {
      const newData = { ...prevState };
      updateObjectByPath(newData, dataPath, value);
      return { ...newData, isChanged: true };
    });
  }

  saveData() {
    const {actuatorData} = this.state;
    this.props.onOK({actuatorData});
    this.props.onClose();
  }

  render() {
    const { actuatorData, isChanged } = this.state;
    if (!actuatorData) return null;
    const { deviceId, onClose, enable} = this.props;
    return (
      <TSModal
        title={"Actuator"}
        visible={enable}
        onCancel={() => onClose()}
        footer={
          [<Button key="cancel" onClick={() => onClose()}>
          Cancel
        </Button>,
        <Button key="ok" type="primary" onClick={() => this.saveData()} disabled={isChanged? false:true}>
          OK
        </Button>]
        }
      >
        <Form
          labelCol={{
            span: 4,
          }}
          wrapperCol={{
            span: 14,
          }}
        >
        <FormTextNotEditableItem label="Device" value={deviceId} />
          <FormEditableTextItem
            label="Id"
            defaultValue={actuatorData.id}
            onChange={(v) => this.onDataChange("actuatorData.id", v)}
            helpText="The identify of the actuator"
            rules = {[
              {
                required: true,
                message: "Id is required!"
              }
            ]}
          />
          <FormEditableTextItem
            label="Object Id"
            defaultValue={actuatorData.objectId}
            onChange={(v) => this.onDataChange("actuatorData.objectId", v)}
            placeholder="Identify of device type (IP Smart Object Format)"
            helpText="The identify of the device type based on IPSO format. For example 3313 - for temperature"
          />
          <FormEditableTextItem
            label="Name"
            defaultValue={actuatorData.name}
            onChange={(v) => this.onDataChange("actuatorData.name", v)}
            helpText="The actuator's name"
          />
          <FormNumberItem
            label="Number of Instance"
            min={1}
            max={1000000}
            placeholder="Number of instances"
            defaultValue={actuatorData.scale ? actuatorData.scale : 1}
            onChange={(v) => this.onDataChange("actuatorData.scale", v)}
            helpText="The number of actuators with the same configuration. The id of the generated actuator will be indexed automatically"
          />
          <FormEditableTextItem
            label="Topic"
            defaultValue={actuatorData.topic}
            onChange={(v) => this.onDataChange("actuatorData.topic", v)}
            helpText="The MQTT/STOMP topic on which the actuator will be listening to receive actuated data"
          />
          <FormSwitchItem
            label="Enable"
            onChange={(v) => this.onDataChange("actuatorData.enable", v)}
            checked={actuatorData.enable ? true : false}
            checkedChildren={"On"}
            unCheckedChildren={"Off"}
            helpText="Enable or disable this actuator from the simulation"
          />
        </Form>
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
  addSimulationActuator: (deviceID, data) =>
    dispatch(addSimulationActuator({ deviceID, actuator: data })),
});

export default connect(mapPropsToStates, mapDispatchToProps)(ActuatorModal);
