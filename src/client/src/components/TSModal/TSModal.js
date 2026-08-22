import React from "react";
import { Modal } from "antd";
import "./style.css";

const TSModal = ({ open, title, footer, onCancel, children }) => (
  <Modal open={open} title={title} footer={footer} onCancel={onCancel}>
    {children}
  </Modal>
);

export default TSModal;
