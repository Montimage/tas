import React from "react";
import {
  FormNumberItem,
  FormCheckBoxItems,
  FormSwitchItem,
} from "../FormItems";

import EnergyForm from "./DataSourceForms/EnergyForm";
import MultipleDataSources from "./DataSourceForms/MultipleDataSources";
import { Button, Divider, Dropdown, Menu } from "antd";
import { UpOutlined } from "@ant-design/icons";

const initEnergy = () => ({
  type: "DATA_SOURCE_ENERGY",
  key: "battery",
  resourceId: "battery-01",
  initValue: 1500,
  unit: "mA",
  behaviours: [],
  low: 1000,
  slowDownRate: 2,
  consumInOnePeriod: 200,
});

const initBoolean = () => ({
  type: "DATA_SOURCE_BOOLEAN",
  key: "your-boolean-data-key",
  resourceId: "boolean-measure-id",
  initValue: true,
  unit: "",
  behaviours: [],
});

const initEnum = () => ({
  type: "DATA_SOURCE_ENUM",
  key: "your-enum-data-key",
  resourceId: "enum-measure-id",
  initValue: "value1",
  unit: "",
  behaviours: [],
  values: ["value1", "value2"],
});

const initInteger = () => ({
  type: "DATA_SOURCE_INTEGER",
  key: "your-integer-data-key",
  resourceId: "integer-measure-id",
  initValue: 10,
  unit: "",
  behaviours: [],
  valueConstraints: {
    min: 0,
    max: 100,
    regularMin: 20,
    regularMax: 80,
    step: 1,
  },
});

const initFloat = () => ({
  type: "DATA_SOURCE_FLOAT",
  key: "your-float-data-key",
  resourceId: "float-measure-id",
  initValue: 10.0,
  unit: "",
  behaviours: [],
  valueConstraints: {
    min: 0,
    max: 100,
    regularMin: 20,
    regularMax: 80,
    step: 1,
  },
});

const DataGeneratorForm = ({ dataPath, dataSpecs, onDataChange }) => (
  <React.Fragment>
    <FormNumberItem
      label="Number of Instance"
      min={1}
      max={1000000}
      placeholder="Number of instances"
      defaultValue={dataSpecs.scale ? dataSpecs.scale : 1}
      onChange={(v) => onDataChange(`${dataPath}.scale`, v)}
      helpText="The number of device with the same configuration. The id of device will be indexed automatically!"
    />
    <FormNumberItem
      label="Time Internal (in seconds)"
      min={1}
      max={65535}
      defaultValue={dataSpecs.timePeriod ? dataSpecs.timePeriod : 5}
      onChange={(v) => onDataChange(`${dataPath}.timePeriod`, v)}
      helpText="The time period to define the publishing data frequency"
      rules={[
        {
          required: true,
          message: "Time internal is required!",
        },
      ]}
    />

    <FormCheckBoxItems
      label="Sensor Behaviours"
      defaultValue={dataSpecs.sensorBehaviours}
      onChange={(v) => onDataChange(`${dataPath}.sensorBehaviours`, v)}
      options={[
        "AB_LOW_ENERGY",
        "AB_OUT_OF_ENERGY",
        "AB_NODE_FAILED",
        "AB_DOS_ATTACK",
        "AB_SLOW_DOS_ATTACK",
        "NORMAL_BEHAVIOUR",
      ]}
      helpText="The possible behaviours of the sensor"
    />
    {dataSpecs.sensorBehaviours.indexOf("AB_DOS_ATTACK") > -1 && (
      <FormNumberItem
        label="Speedup rate"
        min={1}
        max={100}
        defaultValue={dataSpecs.dosAttackSpeedUpRate}
        onChange={(v) => onDataChange(`${dataPath}.dosAttackSpeedUpRate`, v)}
        helpText="The speedup rate in DDOS attack. Define how many time faster the sensor will publish data compare to normal condition"
      />
    )}
    {dataSpecs.sensorBehaviours.indexOf("AB_NODE_FAILED") > -1 && (
      <FormNumberItem
        label="Time Before Failed (seconds)"
        min={1}
        max={65535}
        defaultValue={dataSpecs.timeBeforeFailed}
        onChange={(v) => onDataChange(`${dataPath}.timeBeforeFailed`, v)}
        helpText="The time before this device going to be failed!"
      />
    )}
    <FormSwitchItem
      label="IP Smart Object Format"
      onChange={(v) => onDataChange(`${dataPath}.isIPSOFormat`, v)}
      checked={dataSpecs.isIPSOFormat ? true : false}
      checkedChildren={"Enable"}
      unCheckedChildren={"Disable"}
      helpText="Change the data report to IP Smart Object format"
    />
    <Divider>
      <h3>Measurements</h3>
    </Divider>
    <FormSwitchItem
      label="Energy Measurement"
      onChange={(v) => {
        onDataChange(`${dataPath}.withEnergy`, v);
        if (v && !dataSpecs.energy) {
          onDataChange(`${dataPath}.energy`, initEnergy());
        }
      }}
      checked={dataSpecs.withEnergy ? true : false}
      checkedChildren={"Enable"}
      unCheckedChildren={"Disable"}
      helpText="Enable or disable the energy measurement for this device"
    />
    {dataSpecs.withEnergy && (
      <EnergyForm
        dataPath={`${dataPath}.energy`}
        defaultValue={dataSpecs.energy ? dataSpecs.energy : initEnergy()}
        onChange={(dPath, v) => onDataChange(dPath, v)}
      />
    )}
    <MultipleDataSources
      dataPath={`${dataPath}.sources`}
      sources={dataSpecs.sources ? dataSpecs.sources : []}
      onChange={(dPath, v) => onDataChange(dPath, v)}
    />
    <Dropdown
      overlay={
        <Menu>
          <Menu.Item
            key="1"
            onClick={() => {
              const index = dataSpecs.sources.length;
              const dPath = `${dataPath}.sources[${index}]`;
              onDataChange(dPath, initBoolean());
            }}
          >
            Boolean Data Type
          </Menu.Item>
          <Menu.Item
            key="2"
            onClick={() => {
              const index = dataSpecs.sources.length;
              const dPath = `${dataPath}.sources[${index}]`;
              onDataChange(dPath, initEnum());
            }}
          >
            Enum Data Type
          </Menu.Item>
          <Menu.Item
            key="3"
            onClick={() => {
              const index = dataSpecs.sources.length;
              const dPath = `${dataPath}.sources[${index}]`;
              onDataChange(dPath, initInteger());
            }}
          >
            Integer Data Type
          </Menu.Item>
          <Menu.Item
            key="4"
            onClick={() => {
              const index = dataSpecs.sources.length;
              const dPath = `${dataPath}.sources[${index}]`;
              onDataChange(dPath, initFloat());
            }}
          >
            Float Data Type
          </Menu.Item>
        </Menu>
      }
      placement="topLeft"
    >
      <Button type="primary" style={{ margin: "20px" }}>
        Add New Measure <UpOutlined />
      </Button>
    </Dropdown>
  </React.Fragment>
);

export default DataGeneratorForm;
