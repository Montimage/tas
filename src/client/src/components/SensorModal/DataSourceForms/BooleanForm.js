import React from "react";
import DataSourceForm from "./DataSourceForm";
import { FormSwitchItem } from "../../FormItems";

const BooleanForm = ({ dataPath, defaultValue, onChange }) => (
  <React.Fragment>
    <DataSourceForm
      dataPath={dataPath}
      defaultValue={defaultValue}
      onChange={(dPath, v) => onChange(dPath, v)}
    >
      <FormSwitchItem
        label="Init Value"
        onChange={(v) => onChange(`${dataPath}.initValue`, v)}
        checked={defaultValue.initValue ? true : false}
        checkedChildren={"True"}
        unCheckedChildren={"False"}
      />
    </DataSourceForm>
  </React.Fragment>
);

export default BooleanForm;
