import React from "react";
import { Form, DatePicker } from "antd";
import moment from 'moment';

const { RangePicker } = DatePicker;

const FormTimeRangeItem = ({ label, onChange, defaultValue }) => {
  let startTime = moment();
  let endTime = moment();
  if (defaultValue && defaultValue.length === 2) {
    startTime = moment(defaultValue[0]);
    endTime = moment(defaultValue[1]);
  }
  return (
    <Form.Item label={label}>
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
