import React from "react";
import { PageHeader } from "antd";

import {
  PartitionOutlined,
  BulbOutlined,
  BugOutlined,
} from "@ant-design/icons";
import TSListView from "./TSListView";
import "./style.css";
import CollapseForm from "../CollapseForm";

const ListView = ({
  model: { sensors, actuators, things, name },
  modelType,
  actions: {
    showModal,
    selectThing,
    deleteThing,
    selectSensor,
    deleteSensor,
    selectActuator,
    deleteActuator,
  },
}) => {
  const allSensors = sensors ? [...sensors] : [];
  const allActuators = actuators ? [...actuators] : [];
  if (things) {
    for (let index = 0; index < things.length; index++) {
      const { sensors, actuators } = things[index];
      if (sensors) {
        for (let sindex = 0; sindex < sensors.length; sindex++) {
          allSensors.push({ ...sensors[sindex], thingID: things[index].id });
        }
      }

      if (actuators) {
        for (let sindex = 0; sindex < actuators.length; sindex++) {
          allActuators.push({
            ...actuators[sindex],
            thingID: things[index].id,
          });
        }
      }
    }
  }

  return (
    <div>
      <CollapseForm title="Overview" active={true}>
        <h1>Name: {name}</h1>
        <h1>Type: {modelType}</h1>
      </CollapseForm>
      {things && (
        <CollapseForm title="Things" active={true}>
          <PageHeader
            className="site-page-header"
            title="Things"
            subTitle="All the things"
          />
          <TSListView
            list={things}
            editHandler={(thing) => {
              selectThing(thing);
              showModal("THING-FORM");
            }}
            deleteHandler={(thing) => {
              deleteThing(thing.id);
            }}
            itemAvatar={<PartitionOutlined />}
          />
        </CollapseForm>
      )}
      {allSensors && (
        <CollapseForm title="Sensors" active={false}>
          <PageHeader
            className="site-page-header"
            title="Sensors"
            subTitle="All the sensors"
          />
          <TSListView
            list={allSensors}
            editHandler={(sensor) => {
              selectSensor(sensor);
              showModal("SENSOR-FORM");
            }}
            deleteHandler={(sensor) => {
              deleteSensor(sensor.id, sensor.thingID);
            }}
            itemAvatar={<BugOutlined />}
          />
        </CollapseForm>
      )}
      {allActuators && (
        <CollapseForm title="Actuators" active={false}>
          <PageHeader
            className="site-page-header"
            title="Actuators"
            subTitle="All the actuator"
          />
          <TSListView
            list={allActuators}
            editHandler={(actuator) => {
              selectActuator(actuator);
              showModal("ACTUATOR-FORM");
            }}
            deleteHandler={(actuator) => {
              deleteActuator(actuator.id, actuator.thingID);
            }}
            itemAvatar={<BulbOutlined />}
          />
        </CollapseForm>
      )}
    </div>
  );
};

export default ListView;
