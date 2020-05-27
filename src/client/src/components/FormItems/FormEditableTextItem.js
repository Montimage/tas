import React from "react";
import { Form, Typography } from "antd";
const { Paragraph } = Typography;

const FormEditableTextItem = ({ label, defaultValue, onChange, helpText=null }) => (
  <Form.Item label={label} extra={helpText}>
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
