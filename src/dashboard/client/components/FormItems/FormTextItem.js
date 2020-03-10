import React from 'react';
import { Form, Input } from "antd";

const FormTextItem = ({label, defaultValue, onChange, placeholder}) =>(
  <Form.Item label={label}>
    {defaultValue ? (
      <Input
        defaultValue={defaultValue}
        onChange={v => onChange(v.target.value)}
      />
    ):(
      <Input
        onChange={v => onChange(v.target.value)}
        placeholder={placeholder}
      />
    )}
  </Form.Item>
);

export default FormTextItem;