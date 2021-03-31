import React from "react";
import { FormEditableTextItem, FormCheckBoxItems } from "../../FormItems";
import "./DataSourceForm.css";
import { Button } from "antd";
import CollapseForm from "../../CollapseForm";
import { CloseCircleOutlined } from "@ant-design/icons";

const defaultBehaviours = [
  "AB_FIX_VALUE",
  "AB_INVALID_VALUE"
];

const DataSourceForm = ({
  dataPath,
  defaultValue,
  onChange,
  behaviours,
  children,
}) => (
  <CollapseForm title={defaultValue.key}>
      <FormEditableTextItem
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
      <FormEditableTextItem
        label="Resource Id"
        defaultValue={defaultValue.resourceId}
        onChange={(v) => onChange(`${dataPath}.resourceId`, v)}
        placeholder="Optional"
        helpText="Optional! The resource id if the report follows the IPSO standard! For example: 5700 - for sensor value"
      />
      <FormEditableTextItem
        label="unit"
        defaultValue={defaultValue.unit}
        onChange={(v) => onChange(`${dataPath}.unit`, v)}
        placeholder="Unit of the measurement"
        helpText="Optional! The unit of this measurement"
      />
      <FormCheckBoxItems
        label="Abnormal Behaviours"
        defaultValue={defaultValue.behaviours}
        onChange={(v) => onChange(`${dataPath}.behaviours`, v)}
        options={
          behaviours ? defaultBehaviours.concat(behaviours) : defaultBehaviours
        }
        helpText="The abnormal behaviours of the measurement."
      />
      {children}
      <Button type="danger" onClick={() => onChange(dataPath, null)}>
        <CloseCircleOutlined/> Remove
      </Button>
  </CollapseForm>
);

export default DataSourceForm;
