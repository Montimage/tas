import React from "react";
import DataSourceForm from "./DataSourceForm";
import { FormSelectItem, FormTextItem } from "../../FormItems";

const EnumForm = ({ dataPath, defaultValue, onChange }) => (
  <React.Fragment>
    <DataSourceForm
      dataPath={dataPath}
      defaultValue={defaultValue}
      onChange={(dPath, v) => onChange(dPath, v)}
    >
      <FormSelectItem
        label="Init Value"
        defaultValue={defaultValue.initValue}
        onChange={(v) => onChange(`${dataPath}.initValue`, v)}
        options={defaultValue.values}
      />
      <FormTextItem
        label="Value"
        defaultValue={JSON.stringify(defaultValue.values)}
        onChange={(v) => onChange(`${dataPath}.values`, JSON.parse(v))}
        placeholder="List of value should be separated by comma (,)"
      />
    </DataSourceForm>
  </React.Fragment>
);

export default EnumForm;
