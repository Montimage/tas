import React from 'react';
import { Form, InputNumber } from "antd";

const FormNumberItem = ({label, defaultValue, min, max, onChange}) =>(
  <Form.Item label={label}>
    {defaultValue ? (
      <InputNumber
        min={min}
        max={max}
        defaultValue={defaultValue}
        onChange={v => onChange(v)}
      />
    ):(
      <InputNumber
        min={min}
        max={max}
        onChange={v => onChange(v)}
      />
    )}
  </Form.Item>
);

export default FormNumberItem;