import React from "react";
import { List, Avatar, PageHeader, Button, Switch } from "antd";
import {
  BugOutlined,
  PartitionOutlined,
  BulbOutlined
} from "@ant-design/icons";
import CollapseForm from "../../CollapseForm";
import TSListView from "../TSListView";

const ThingItem = ({
  thing,
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
    changeStatusActuator

  },
}) => (
  <CollapseForm title={`Thing ${thing.id}`}>
    <List.Item
      actions={[
        <Button
          key="thing-edit"
          size="small"
          onClick={() => {
            selectThing(thing);
            showModal("THING-FORM");
          }}
        >
          Edit
        </Button>,
        <Button
          key="thing-delete"
          size="small"
          onClick={() => {
            deleteThing(thing.id);
          }}
          type="danger"
        >
          Delete
        </Button>,
        <Switch
          key="thing-enable"
          onChange={v => {
            changeStatusThing(thing.id);
          }}
          checkedChildren={'Enable'}
          unCheckedChildren={'Disable'}
          checked={thing.enable}
        />,
      ]}
    >
      <List.Item.Meta
        avatar={
          <Avatar>
            <PartitionOutlined />
          </Avatar>
        }
        title={
          <a
            onClick={() => {
              selectThing(thing);
              showModal("THING-FORM");
            }}
          >
            {thing.name ? thing.name : thing.id}
          </a>
        }
        description={`Id: ${thing.id}${
          thing.name ? `- name: ${thing.name}` : ""
        }- enable: ${thing.enable ? true : false}`}
      />
    </List.Item>
    <PageHeader
          className="site-page-header"
          title="Connection"
          subTitle={`Protocol: ${thing.protocol}`}
        />
    <p>Host: <strong>{thing.connConfig.host}</strong></p>
    <p>Port: <strong>{thing.connConfig.port}</strong></p>
    {thing.sensors && (
      <React.Fragment>
        <PageHeader
          className="site-page-header"
          title="Sensors"
          subTitle={`Total: ${thing.sensors.length}`}
        />
        <TSListView
          list={thing.sensors}
          editHandler={(sensor) => {
            selectSensor(sensor);
            showModal("SENSOR-FORM");
          }}
          deleteHandler={(sensor) => {
            deleteSensor(sensor.id, thing.id);
          }}
          changeStatus = {(sensor) => {
            changeStatusSensor(sensor.id, thing.id);
          }}
          itemAvatar={<BugOutlined />}
        />
      </React.Fragment>
    )}
    {thing.actuators && (
      <React.Fragment>
        <PageHeader
          className="site-page-header"
          title="Actuators"
          subTitle={`Total: ${thing.actuators.length}`}
        />
        <TSListView
          list={thing.actuators}
          editHandler={(actuator) => {
            selectActuator(actuator);
            showModal("ACTUATOR-FORM");
          }}
          deleteHandler={(actuator) => {
            deleteActuator(actuator.id, thing.id);
          }}
          changeStatus = {(actuator) => {
            changeStatusActuator(actuator.id, thing.id);
          }}
          itemAvatar={<BulbOutlined />}
        />
      </React.Fragment>
    )}
  </CollapseForm>
);

const ThingsView = ({
  things,
  actions,
}) => (
  <List
    itemLayout="horizontal"
    dataSource={things}
    renderItem={(item) => (
      <ThingItem
        thing={item}
        actions={actions}
      />
    )}
  />
);

export default ThingsView;
