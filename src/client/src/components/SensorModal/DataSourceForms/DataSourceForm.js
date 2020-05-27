import React from "react";
import { FormTextItem, FormCheckBoxItems } from "../../FormItems";
import "./DataSourceForm.css";
import { Button } from "antd";
import CollapseForm from "../../CollapseForm";

const defaultBehaviours = [
  "AB_FIX_VALUE",
  "AB_INVALID_VALUE",
  "NORMAL_BEHAVIOUR",
];

const DataSourceForm = ({
  dataPath,
  defaultValue,
  onChange,
  behaviours,
  children,
}) => (
  <CollapseForm title={defaultValue.key}>
      <FormTextItem
        label="key"
        defaultValue={defaultValue.key}
        onChange={(v) => onChange(`${dataPath}.key`, v)}
        placeholder="Require"
        helpText="The key or the id to identify this measurement"
        rules = {[
              {
                required: true,
                message: "Key is required!"
              }
            ]}
      />
      <FormTextItem
        label="Resource Id"
        defaultValue={defaultValue.resourceId}
        onChange={(v) => onChange(`${dataPath}.resourceId`, v)}
        placeholder="Optional"
        helpText="The resource id if the report follows the IPSO standard! For example: 5700 - for sensor value"
      />
      <FormTextItem
        label="unit"
        defaultValue={defaultValue.unit}
        onChange={(v) => onChange(`${dataPath}.unit`, v)}
        placeholder="Unit of the measurement"
        helpText="The unit of this measurement"
      />
      <FormCheckBoxItems
        label="Behaviours"
        defaultValue={defaultValue.behaviours}
        onChange={(v) => onChange(`${dataPath}.behaviours`, v)}
        options={
          behaviours ? defaultBehaviours.concat(behaviours) : defaultBehaviours
        }
        helpText="The abnormal behaviours of the measurement."
      />
      {children}
      <Button type="danger" onClick={() => onChange(dataPath, null)}>
        Remove
      </Button>
  </CollapseForm>
);

export default DataSourceForm;
