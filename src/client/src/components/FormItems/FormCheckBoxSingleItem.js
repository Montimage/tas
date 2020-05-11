import React from 'react';
import { Form, Checkbox } from "antd";

const FormCheckBoxSingleItem = ({label, checked, onChange}) =>(
  <Form.Item label={label}>
    <Checkbox
      onChange={e => onChange(e.target.checked)}
      checked={checked}
    />
  </Form.Item>
);

export default FormCheckBoxSingleItem;