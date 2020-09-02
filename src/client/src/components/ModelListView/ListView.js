import React from "react";

import {
  BulbOutlined,
  BugOutlined,
  PlusCircleOutlined,
} from "@ant-design/icons";
import TSListView from "./TSListView";
import ThingsView from "./ThingsView";
import "./style.css";
import CollapseForm from "../CollapseForm";
import { Typography, Button } from "antd";
import { FormEditableTextItem } from "../FormItems";

const ListView = ({
  model: { sensors, actuators, things, name },
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
      <FormEditableTextItem
        label="Model Name"
        defaultValue={name}
        onChange={(newName) => changeModelName(newName)}
      />
      {}
    </CollapseForm>
    {things && (
      <CollapseForm
        title={`Things (${things.length})`}
        active={true}
        extra={
          <Button
            onClick={(event) => {
              event.stopPropagation();
              showModal("THING-FORM");
            }}
          >
            <PlusCircleOutlined /> Add New Thing
          </Button>
        }
      >
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
