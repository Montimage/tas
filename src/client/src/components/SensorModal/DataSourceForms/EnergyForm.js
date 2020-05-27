import React from "react";
import DataSourceForm from "./DataSourceForm";
import { FormNumberItem, FormRegularNumberItem } from "../../FormItems";

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
        helpText="The initialize energy value!"
      />
      <FormRegularNumberItem
        label="Energy"
        items={[
          {
            title: "Consum",
            dataPath: `${dataPath}.consumInOnePeriod`,
            defaultValue: defaultValue.consumInOnePeriod,
          },
          {
            title: "Low",
            dataPath: `${dataPath}.low`,
            defaultValue: defaultValue.low,
          },
          {
            title: "Slow Down Rate",
            dataPath: `${dataPath}.slowDownRate`,
            defaultValue: defaultValue.slowDownRate,
          },
        ]}
        onChange={(dPath, v) => onChange(dPath, v)}
        helpText="The energy specification!"
      />
    </DataSourceForm>
  </React.Fragment>
);

export default EnergyForm;
