import React from "react";
import DataSourceForm from "./DataSourceForm";
import { FormNumberItem } from "../../FormItems";

const EnergyForm = ({ dataPath, defaultValue, onChange }) => (
  <React.Fragment>
    <DataSourceForm
      dataPath={dataPath}
      defaultValue={defaultValue}
      onChange={(dPath, v) => onChange(dPath, v)}
    >
      <FormNumberItem
        label="Init Value"
        min={1}
        max={65535}
        defaultValue={defaultValue.initValue}
        onChange={(v) => onChange(`${dataPath}.initValue`, v)}
      />
      <FormNumberItem
        label="Low"
        min={1}
        max={65535}
        defaultValue={defaultValue.low}
        onChange={(v) => onChange(`${dataPath}.low`, v)}
      />
      <FormNumberItem
        label="Slow Down Rate"
        min={1}
        max={65535}
        defaultValue={defaultValue.slowDownRate}
        onChange={(v) => onChange(`${dataPath}.slowDownRate`, v)}
      />
      <FormNumberItem
        label="Consum"
        min={1}
        max={65535}
        defaultValue={defaultValue.consumInOnePeriod}
        onChange={(v) => onChange(`${dataPath}.consumInOnePeriod`, v)}
      />
    </DataSourceForm>
  </React.Fragment>
);

export default EnergyForm;
