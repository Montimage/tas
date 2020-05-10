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
        label="Resource Id"
        defaultValue={defaultValue.resourceId}
        onChange={(v) => onChange(`${dataPath}.resourceId`, v)}
        placeholder="Optional"
      />
      <FormTextItem
        label="key"
        defaultValue={defaultValue.key}
        onChange={(v) => onChange(`${dataPath}.key`, v)}
        placeholder="Require"
      />
      <FormTextItem
        label="unit"
        defaultValue={defaultValue.unit}
        onChange={(v) => onChange(`${dataPath}.unit`, v)}
        placeholder="Unit of the measurement"
      />
      <FormCheckBoxItems
        label="Behaviours"
        defaultValue={defaultValue.behaviours}
        onChange={(v) => onChange(`${dataPath}.behaviours`, v)}
        options={
          behaviours ? defaultBehaviours.concat(behaviours) : defaultBehaviours
        }
      />
      {children}
      <Button type="danger" onClick={() => onChange(dataPath, null)}>
        Remove
      </Button>
  </CollapseForm>
);

export default DataSourceForm;
