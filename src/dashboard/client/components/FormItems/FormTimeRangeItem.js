import React from "react";
import { Form, DatePicker } from "antd";
const { RangePicker } = DatePicker;

const FormTimeRangeItem = ({ label, onChange }) => (
  <Form.Item label={label}>
    <RangePicker
      showTime={{ format: "HH:mm" }}
      format="YYYY-MM-DD HH:mm"
      onChange={(value, dateString) =>
        onChange([
          new Date(dateString[0]).getTime() / 1000,
          new Date(dateString[1]).getTime() / 1000
        ])
      }
    />
  </Form.Item>
);

export default FormTimeRangeItem;
