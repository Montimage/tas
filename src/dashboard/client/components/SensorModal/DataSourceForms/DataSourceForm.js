import React from "react";
import { FormTextItem, FormCheckBoxItems } from "../../FormItems";
import './DataSourceForm.css';

const defaultBehaviours = [
  "AB_FIX_VALUE",
  "AB_INVALID_VALUE",
  "NORMAL_BEHAVIOUR",
];

const DataSourceForm = ({ dataPath, defaultValue, onChange, behaviours, children }) => (
  <div className="DataSourceForm">
    <FormTextItem
      label="Id"
      defaultValue={defaultValue.id}
      onChange={(v) => onChange(`${dataPath}.id`, v)}
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
  </div>
);

export default DataSourceForm;
