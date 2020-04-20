import React from "react";
import {
  FormNumberItem,
  FormCheckBoxItems,
  FormSwitchItem,
} from "../FormItems";

import EnergyForm from "./DataSourceForms/EnergyForm";
import MultipleDataSources from "./DataSourceForms/MultipleDataSources";

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
    <FormSwitchItem
      label="Enable Energy Measure"
      onChange={(v) => onDataChange(`${dataPath}.withEnergy`, v)}
      checked={dataSource.withEnergy ? true : false}
      checkedChildren={"On"}
      unCheckedChildren={"Off"}
    />
    {dataSource.withEnergy && (
      <EnergyForm
        dataPath={`${dataPath}.energy`}
        defaultValue={dataSource.energy ? dataSource.energy : initEnergy}
        onChange={(dPath, v) => onDataChange(dPath, v)}
      />
    )}
    <h1>Measurements</h1>
    <MultipleDataSources
      dataPath={`${dataPath}.sources`}
      sources={dataSource.sources ? dataSource.sources : []}
      onChange={(dPath, v, index = null) => onDataChange(dPath, v, index)}
    />
  </React.Fragment>
);

export default DataGeneratorForm;
