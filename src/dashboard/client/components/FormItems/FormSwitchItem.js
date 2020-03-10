import React from 'react';
import { Form, Switch } from "antd";

const FormSwitchItem = ({label, checked, onChange, checkedChildren, unCheckedChildren}) =>(
  <Form.Item label={label}>
    <Switch
      onChange={v => onChange(v)}
      checkedChildren={checkedChildren}
      unCheckedChildren={unCheckedChildren}
      checked={checked}
    />
  </Form.Item>
);

export default FormSwitchItem;