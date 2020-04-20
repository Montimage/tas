import React from "react";
import { Form, InputNumber, List, Card } from "antd";

const FormRegularNumberItem = ({ label, items, onChange }) => (
  <Form.Item label={label}>
    <List
      grid={{ gutter: 16, column: items.length }}
      dataSource={items}
      renderItem={(item) => (
        <List.Item>
          {`${item.title} `}
          <InputNumber
            onChange={(v) => onChange(item.dataPath, v)}
            defaultValue={item.defaultValue ? item.defaultValue : 0}
            placeholder={item.title}
          />
        </List.Item>
      )}
    />
  </Form.Item>
);

export default FormRegularNumberItem;
