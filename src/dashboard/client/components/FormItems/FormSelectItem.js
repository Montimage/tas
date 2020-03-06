import React from 'react';
import { Form, Select } from "antd";

const FormSelectItem = ({label, defaultValue, onChange, options}) => (
  <Form.Item label={label}>
    <Select
      defaultValue={defaultValue ? defaultValue : (options ? options[0] : null) }
      onChange={v => onChange( v)}
    >
      {options.map(tid => (
        <Select.Option value={tid} key={tid}>{tid}</Select.Option>
      ))}
    </Select>
  </Form.Item>
)

export default FormSelectItem;