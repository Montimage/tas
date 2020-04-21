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

const initEnergy = {
  type: "DATA_SOURCE_ENERGY",
  key: "battery",
  id: "battery-01",
  initValue: 1500,
  unit: "mA",
  behaviours: [],
  low: 1000,
  slowDownRate: 2,
  consumInOnePeriod: 200,
};

const initBoolean = {
  type: "DATA_SOURCE_BOOLEAN",
  key: "your-boolean-data-key",
  id: "boolean-measure-id",
  initValue: true,
  unit: "",
  behaviours: [],
};

const initEnum = {
  type: "DATA_SOURCE_ENUM",
  key: "your-enum-data-key",
  id: "enum-measure-id",
  initValue: "value1",
  unit: "",
  behaviours: [],
  values: ["value1", "value2"],
};

const initInteger = {
  type: "DATA_SOURCE_INTEGER",
  key: "your-integer-data-key",
  id: "integer-measure-id",
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
};

const initFloat = {
  type: "DATA_SOURCE_FLOAT",
  key: "your-float-data-key",
  id: "float-measure-id",
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
};

const DataGeneratorForm = ({ dataPath, dataSource, onDataChange }) => (
  <React.Fragment>
    <FormNumberItem
      label="Scale"
      min={1}
      max={1000000}
      placeholder="Number of instances"
      defaultValue={dataSource.scale}
      onChange={(v) => onDataChange(`${dataPath}.scale`, v)}
    />
    <FormNumberItem
      label="Time Period"
      min={1}
      max={65535}
      defaultValue={dataSource.timePeriod}
      onChange={(v) => onDataChange(`${dataPath}.timePeriod`, v)}
    />

    <FormCheckBoxItems
      label="Sensor Behaviours"
      defaultValue={dataSource.sensorBehaviours}
      onChange={(v) => onDataChange(`${dataPath}.sensorBehaviours`, v)}
      options={[
        "AB_LOW_ENERGY",
        "AB_OUT_OF_ENERGY",
        "AB_NODE_FAILED",
        "AB_DOS_ATTACK",
        "AB_SLOW_DOS_ATTACK",
        "NORMAL_BEHAVIOUR",
      ]}
    />
    {dataSource.sensorBehaviours.indexOf("AB_DOS_ATTACK") > -1 && (
      <FormNumberItem
        label="DOS attack speedup rate"
        min={1}
        max={100}
        defaultValue={dataSource.dosAttackSpeedupRate}
        onChange={(v) => onDataChange(`${dataPath}.dosAttackSpeedupRate`, v)}
      />
    )}
    {dataSource.sensorBehaviours.indexOf("AB_NODE_FAILED") > -1 && (
      <FormNumberItem
        label="Time Before Failed"
        min={1}
        max={65535}
        defaultValue={dataSource.timeBeforeFailed}
        onChange={(v) => onDataChange(`${dataPath}.timeBeforeFailed`, v)}
      />
    )}
    <Divider>
      <h3>Measurements</h3>
    </Divider>
    <FormSwitchItem
      label="Energy Measurement"
      onChange={(v) => onDataChange(`${dataPath}.withEnergy`, v)}
      checked={dataSource.withEnergy ? true : false}
      checkedChildren={"Enable"}
      unCheckedChildren={"Disable"}
    />
    {dataSource.withEnergy && (
      <EnergyForm
        dataPath={`${dataPath}.energy`}
        defaultValue={dataSource.energy ? dataSource.energy : initEnergy}
        onChange={(dPath, v) => onDataChange(dPath, v)}
      />
    )}
    <MultipleDataSources
      dataPath={`${dataPath}.sources`}
      sources={dataSource.sources ? dataSource.sources : []}
      onChange={(dPath, v) => onDataChange(dPath, v)}
    />
    <Dropdown
      overlay={
        <Menu>
          <Menu.Item
            key="1"
            onClick={() => {
              const index = dataSource.sources.length;
              const dPath = `${dataPath}.sources[${index}]`;
              onDataChange(dPath, initBoolean);
            }}
          >
            Boolean Data Type
          </Menu.Item>
          <Menu.Item
            key="2"
            onClick={() => {
              const index = dataSource.sources.length;
              const dPath = `${dataPath}.sources[${index}]`;
              onDataChange(dPath, initEnum);
            }}
          >
            Enum Data Type
          </Menu.Item>
          <Menu.Item
            key="3"
            onClick={() => {
              const index = dataSource.sources.length;
              const dPath = `${dataPath}.sources[${index}]`;
              onDataChange(dPath, initInteger);
            }}
          >
            Integer Data Type
          </Menu.Item>
          <Menu.Item
            key="4"
            onClick={() => {
              const index = dataSource.sources.length;
              const dPath = `${dataPath}.sources[${index}]`;
              onDataChange(dPath, initFloat);
            }}
          >
            Float Data Type
          </Menu.Item>
        </Menu>
      }
      placement="topLeft"
    >
      <Button type="primary" style={{margin: '20px'}}>
        Add New Measure <UpOutlined />
      </Button>
    </Dropdown>
  </React.Fragment>
);

export default DataGeneratorForm;
