import React from "react";
import TSModal from "../TSModal";
import { Checkbox, List } from "antd";

const SelectionModal = ({
  onCancel,
  onChange,
  enable,
  options,
  defaultValue,
  title
}) => (
  <TSModal
    title={title}
    visible={enable}
    onCancel={() => onCancel()}
    footer={[]}
  >
    <Checkbox.Group
      style={{ width: "100%" }}
      defaultValue={defaultValue}
      onChange={(values) => onChange(values)}
    >
      <List
        size="small"
        dataSource={options}
        renderItem={(item) => (
          <List.Item>
            <Checkbox value={item.id}>{item.name}</Checkbox>
          </List.Item>
        )}
      />
    </Checkbox.Group>
  </TSModal>
);
export default SelectionModal;
