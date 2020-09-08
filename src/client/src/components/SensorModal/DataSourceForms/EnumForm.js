import React from "react";
import DataSourceForm from "./DataSourceForm";
import { FormSelectItem, FormEditableTextItem } from "../../FormItems";

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
        helpText="Initial value!"
      />
      <FormEditableTextItem
        label="Value"
        defaultValue={JSON.stringify(defaultValue.values)}
        onChange={(v) => onChange(`${dataPath}.values`, JSON.parse(v))}
        placeholder="value1, value2, value3"
        helpText="The list of possible values. Each value should be separated by a comma (,)"
        rules = {[
              {
                required: true,
                message: "Values is required!"
              }
            ]}
      />
    </DataSourceForm>
  </React.Fragment>
);

export default EnumForm;
