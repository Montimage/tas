import React, { Component, Fragment } from "react";
import TSModal from "../TSModal";
import { Form, Button, Divider } from "antd";
import {
  FormSwitchItem,
  FormEditableTextItem,
  FormTextNotEditableItem,
  FormSelectItem,
  FormTimeRangeItem,
  FormNumberItem,
} from "../FormItems";

import { updateObjectByPath } from "../../utils";
import DataGeneratorForm from "./DataGeneratorForm";
import CollapseForm from "../CollapseForm";

class SensorModal extends Component {
  constructor(props) {
    super(props);
    const { sensorData } = props;
    this.state = {
      sensorData,
      isChanged: false,
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
    const { sensorData } = this.state;
    this.props.onOK(sensorData);
    this.props.onClose();
  }

  render() {
    const { sensorData, isChanged } = this.state;
    const { enable, onClose, deviceId } = this.props;
    if (!sensorData) return null;
    const reportFormats = ["PLAIN_DATA", "JSON_OBJECT", "IPSO_FORMAT"];
    const reportFormatHelpTexts = [
      "Report only the value of the sensor. The value will be in array if the sensor has multiple measurements",
      "Report the value of the sensor in JSON Object format, with the keys are defined in the description of the sensor",
      "Report the value of the sensor in JSON Object and follow the IPSO format, with the keys are defined in the description of the sensor",
    ];
    return (
      <TSModal
        title={`Sensor ${sensorData.name}`}
        visible={enable}
        onCancel={() => onClose()}
        footer={[
          <Button key="cancel" onClick={() => onClose()}>
            Cancel
          </Button>,
          <Button
            key="ok"
            type="primary"
            onClick={() => this.saveData()}
            disabled={isChanged ? false : true}
          >
            OK
          </Button>,
        ]}
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
            defaultValue={sensorData.id}
            onChange={(v) => this.onDataChange("sensorData.id", v)}
            placeholder="Identify of the device"
            helpText="The identify of the device"
            rules={[
              {
                required: true,
                message: "Id is required!",
              },
            ]}
          />
          <FormEditableTextItem
            label="Object Id"
            defaultValue={sensorData.objectId}
            onChange={(v) => this.onDataChange("sensorData.objectId", v)}
            placeholder="Identify of the type of device (IPSO Standard)"
            helpText="The identify of the device type based on IPSO format. For example 3313 - for temperature"
          />
          <FormEditableTextItem
            label="Name"
            defaultValue={sensorData.name}
            onChange={(v) => this.onDataChange("sensorData.name", v)}
            helpText="The name of the device"
          />
          <FormEditableTextItem
            label="Topic"
            defaultValue={sensorData.topic}
            onChange={(v) => this.onDataChange("sensorData.topic", v)}
            helpText="The topic to which the sensor will publish data!"
          />
          <FormSwitchItem
            label="Enable"
            onChange={(v) => this.onDataChange("sensorData.enable", v)}
            checked={sensorData.enable ? true : false}
            checkedChildren={"On"}
            unCheckedChildren={"Off"}
            helpText="Enable or disable this device from the simulation"
          />
          <FormSelectItem
            label="Report Format"
            defaultValue={reportFormats[sensorData.reportFormat]}
            helpText={reportFormatHelpTexts[sensorData.reportFormat]}
            options={reportFormats}
            onChange={(v) =>
              this.onDataChange(
                "sensorData.reportFormat",
                reportFormats.indexOf(v)
              )
            }
          />
          <FormSelectItem
            label="Data Source"
            defaultValue={sensorData.dataSource}
            options={[
              "DATA_SOURCE_DATASET",
              "DATA_SOURCE_GENERATOR",
              "DATA_SOURCE_RECORDER",
            ]}
            onChange={(v) => this.onDataChange("sensorData.dataSource", v)}
          />
          {sensorData.dataSource === "DATA_SOURCE_DATASET" && (
            <Fragment>
              {sensorData.replayOptions ? (
                <CollapseForm title="Replay Options">
                  <FormTimeRangeItem
                    label="Time Range"
                    defaultValue={[
                      sensorData.replayOptions.startTime
                        ? sensorData.replayOptions.startTime
                        : 0,
                      sensorData.replayOptions.endTime
                        ? sensorData.replayOptions.endTime
                        : Date.now(),
                    ]}
                    onChange={(v) => {
                      this.onDataChange(
                        `sensorData.replayOptions.startTime`,
                        v[0]
                      );
                      this.onDataChange(
                        `sensorData.replayOptions.endTime`,
                        v[1]
                      );
                    }}
                    helpText="The time range when the data should be replayed."
                  />
                  <FormNumberItem
                    label="Speedup"
                    min={0.01}
                    max={100}
                    defaultValue={
                      sensorData.replayOptions.speedup
                        ? sensorData.replayOptions.speedup
                        : 1
                    }
                    onChange={(v) =>
                      this.onDataChange(`sensorData.replayOptions.speedup`, v)
                    }
                    helpText="The replaying speedup (0.01 - 100)!"
                  />
                  <FormSwitchItem
                    label="Repeat"
                    onChange={(v) =>
                      this.onDataChange(`sensorData.replayOptions.repeat`, v)
                    }
                    checked={sensorData.replayOptions.repeat ? true : false}
                    checkedChildren={"Repeat"}
                    unCheckedChildren={"No Repeat"}
                    helpText="Repeatly replaying the data"
                  />
                  <Button
                    danger
                    onClick={() =>
                      this.onDataChange("sensorData.replayOptions", null)
                    }
                  >
                    Delete Replaying Options
                  </Button>
                </CollapseForm>
              ) : (
                <Button
                style={{marginBottom: 10}}
                  onClick={() =>
                    this.onDataChange("sensorData.replayOptions", {
                      startTime: 0,
                      endTime: Date.now(),
                      repeat: false,
                      speedup: 1,
                    })
                  }
                >
                  Set Replaying Options
                </Button>
              )}
            </Fragment>
          )}
          <DataGeneratorForm
            dataPath={"sensorData.dataSpecs"}
            dataSpecs={sensorData.dataSpecs}
            onDataChange={(dataPath, value) =>
              this.onDataChange(dataPath, value)
            }
          />
        </Form>
      </TSModal>
    );
  }
}

export default SensorModal;
