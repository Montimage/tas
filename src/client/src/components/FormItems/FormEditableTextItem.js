import React from "react";
import { Form, Typography } from "antd";
const { Paragraph, Text } = Typography;

const FormEditableTextItem = ({ label, defaultValue, onChange }) => (
  <Form.Item label={label}>
      <Paragraph
        editable={{
          onChange: (v) => {
            onChange(v);
          },
        }}
      >
        {defaultValue}
      </Paragraph>
  </Form.Item>
);

export default FormEditableTextItem;
