import React from "react";
import { Form, Checkbox } from "antd";

const FormCheckBoxItem = ({ label, defaultValue, onChange, options }) => (
  <Form.Item label={label}>
    <Checkbox.Group
      options={options}
      defaultValue={defaultValue}
      onChange={onChange}
    />
  </Form.Item>
);

export default FormCheckBoxItem;
