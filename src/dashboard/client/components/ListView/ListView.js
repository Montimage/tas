import React from "react";

import { BulbOutlined, BugOutlined } from "@ant-design/icons";
import TSListView from "./TSListView";
import ThingsView from "./ThingsView";
import "./style.css";
import CollapseForm from "../CollapseForm";
import { Typography } from 'antd';
const { Paragraph } = Typography;

const ListView = ({
  model: { sensors, actuators, things, name },
  modelType,
  actions: {
    showModal,
    selectThing,
    deleteThing,
    changeStatusThing,
    selectSensor,
    deleteSensor,
    changeStatusSensor,
    selectActuator,
    deleteActuator,
    changeStatusActuator,
    changeModelName,
  },
}) => (
  <div>
    <CollapseForm title="Overview" active={true}>
      <Paragraph
        editable={{
          onChange: (newName) => {
            changeModelName(newName);
          },
        }}
      >
        {name}
      </Paragraph>
      <span>
        Type: <strong>{modelType}</strong>
      </span>
    </CollapseForm>
    {things && (
      <CollapseForm title={`Things (${things.length})`} active={true}>
        <ThingsView
          things={things}
          actions={{
            showModal,
            selectThing,
            deleteThing,
            changeStatusThing,
            selectSensor,
            deleteSensor,
            changeStatusSensor,
            selectActuator,
            deleteActuator,
            changeStatusActuator,
          }}
        />
      </CollapseForm>
    )}
    {sensors && (
      <CollapseForm title={`Free Sensors (${sensors.length})`} active={false}>
        <TSListView
          list={sensors}
          editHandler={(sensor) => {
            selectSensor(sensor);
            showModal("SENSOR-FORM");
          }}
          deleteHandler={(sensor) => {
            deleteSensor(sensor.id, null);
          }}
          changeStatus={(sensor) => {
            changeStatusSensor(sensor.id, null);
          }}
          itemAvatar={<BugOutlined />}
        />
      </CollapseForm>
    )}
    {actuators && (
      <CollapseForm
        title={`Free Actuators (${actuators.length})`}
        active={false}
      >
        <TSListView
          list={actuators}
          editHandler={(actuator) => {
            selectActuator(actuator);
            showModal("ACTUATOR-FORM");
          }}
          deleteHandler={(actuator) => {
            deleteActuator(actuator.id, null);
          }}
          changeStatus={(actuator) => {
            changeStatusActuator(actuator.id, null);
          }}
          itemAvatar={<BulbOutlined />}
        />
      </CollapseForm>
    )}
  </div>
);
export default ListView;
