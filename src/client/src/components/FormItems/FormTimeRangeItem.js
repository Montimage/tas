import React from "react";
import { Form, DatePicker } from "antd";
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;

const FormTimeRangeItem = ({ label, onChange, defaultValue, helpText = null }) => {
  let startTime = dayjs();
  let endTime = dayjs();
  if (defaultValue && defaultValue.length === 2) {
    startTime = dayjs(defaultValue[0]);
    endTime = dayjs(defaultValue[1]);
  }
  return (
    <Form.Item label={label} extra={helpText}>
    <RangePicker
      defaultValue={[startTime, endTime]}
      showTime={{ format: "HH:mm" }}
      format="YYYY-MM-DD HH:mm"
      onChange={(value, dateString) =>
        onChange([
          new Date(dateString[0]).getTime(),
          new Date(dateString[1]).getTime()
        ])
      }
    />
  </Form.Item>
  )
};

export default FormTimeRangeItem;
