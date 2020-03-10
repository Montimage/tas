import React from 'react';
import { Form, InputNumber } from "antd";

const FormNumberItem = ({label, defaultValue, min, max, onChange, placeholder}) =>(
  <Form.Item label={label}>
    {defaultValue ? (
      <InputNumber
        min={min}
        max={max}
        defaultValue={defaultValue}
        onChange={v => onChange(v)}
        placeholder={placeholder}
      />
    ):(
      <InputNumber
        min={min}
        max={max}
        onChange={v => onChange(v)}
        placeholder={placeholder}
      />
    )}
  </Form.Item>
);

export default FormNumberItem;