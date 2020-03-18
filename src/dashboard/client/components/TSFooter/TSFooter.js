import React from "react";
import { Layout } from 'antd';
const { Footer } = Layout;
import VERSION from "../../VERSION";

const TSFooter = () => (
  <Footer style={{ textAlign: "center" }}>
    ENACT ©{new Date().getFullYear()} Created by{" "}
    <a href="https://www.montimage.com">Montimage</a>. Version {VERSION}
  </Footer>
);

export default TSFooter;
