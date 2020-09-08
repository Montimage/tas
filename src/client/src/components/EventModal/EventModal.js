import React, { Component } from "react";
import TSModal from "../TSModal";
import { Form, Button } from "antd";
import {
  updateObjectByPath,
  deepCloneObject,
} from "../../utils";
import {
  FormTextItem,
  FormSwitchItem,
  FormEditableTextItem,
  FormTextNotEditableItem,
} from "../FormItems";

const initEvent = () => ({
  timestamp: Date.now(),
  topic: `topic-${Date.now()}`,
  isSensorData: false,
  values: `values-${Date.now()}`,
  datasetId: `datasetId-${Date.now()}`,
});

class EventModal extends Component {
  constructor(props) {
    super(props);
    this.state = {
      event: props.event? deepCloneObject(props.event) : initEvent(),
    };
  }

  onDataChange(dataPath, value) {
    this.setState((prevState) => {
      const newData = { ...prevState.event };
      updateObjectByPath(newData, dataPath, value);
      return { event: newData};
    });
  }

  render() {
    const { event } = this.state;
    const {timestamp, topic, isSensorData, values, datasetId } = event;
    const {onCancel, onOK, enable } = this.props;
    const footer = [
      <Button key="cancel" onClick={() => onCancel()}>
        Cancel
      </Button>,
      <Button key="ok" type="primary" onClick={() => onOK(event)}>
        OK
      </Button>,
    ];

    return (
      <TSModal
        title={"Event"}
        visible={enable}
        onCancel={() => onCancel()}
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
          <FormEditableTextItem
            label="Timestamp"
            defaultValue={timestamp}
            onChange={(v) => this.onDataChange("timestamp", v)}
            helpText="The timestamp of the event"
          />
          <FormEditableTextItem
            label="Topic"
            defaultValue={topic}
            onChange={(v) => this.onDataChange("topic", v)}
            helpText="The MQTT/STOMP topic on which the actuator will be listening to receive actuated data"
          />
          <FormSwitchItem
            label="Is Sensor Data"
            onChange={(v) => this.onDataChange(`isSensorData`, v)}
            checked={isSensorData ? true : false}
            checkedChildren={"data sent by sensor"}
            unCheckedChildren={"data received by actuator"}
            helpText="True if this is the data sent by sensor"
          />
          <FormTextNotEditableItem
            label="Dataset Id"
            value={datasetId}
            helpText="The timestamp of the event"
          />
          <FormEditableTextItem
            label="Value"
            defaultValue={JSON.stringify(values)}
            onChange={(v) => this.onDataChange("values", JSON.parse(v))}
            helpText="The value of the event"
          />
        </Form>
      </TSModal>
    );
  }
}

export default EventModal;