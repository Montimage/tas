import React from "react";
import { Form, Input } from "antd";

const FormTextItem = ({
  label,
  defaultValue,
  onChange,
  placeholder,
  helpText = null,
  rules=null,
}) => (
  <Form.Item label={label} name={label} extra={helpText} rules={rules}>
    <Input
      defaultValue={defaultValue}
      onChange={(v) => onChange(v.target.value)}
      placeholder={placeholder}
      style={{ minWidth: 300 }} 
    />
  </Form.Item>
);

export default FormTextItem;
