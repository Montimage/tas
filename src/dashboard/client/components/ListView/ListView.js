import React from 'react';
import { PageHeader } from 'antd';

import {PartitionOutlined, BulbOutlined, BugOutlined} from '@ant-design/icons';
import TSListView from './TSListView';

const ListView = ({
  model: { sensors, actuators, dbConfig, things, name },
  actions: {
    showModal,
    selectThing,
    deleteThing,
    selectSensor,
    deleteSensor,
    selectActuator,
    deleteActuator,
  }
}) => {
  let modelType = "Data Generator";
  const allSensors = sensors ? [...sensors] : [];
  const allActuators = actuators ? [...actuators] : [];
  if (things) {
    modelType = "Simulation";
    for (let index = 0; index < things.length; index++) {
      const { sensors, actuators } = things[index];
      for (let sindex = 0; sindex < sensors.length; sindex++) {
        allSensors.push({ ...sensors[sindex], thingID: things[index].id });
      }

      for (let sindex = 0; sindex < actuators.length; sindex++) {
        allActuators.push({ ...actuators[sindex], thingID: things[index].id });
      }
    }
  }

  return (
    <div>
      <h1>
        <PageHeader
          className="site-page-header"
          title={name}
          subTitle={modelType}
        />
      </h1>
      {things && (
        <div>
          <PageHeader
            className="site-page-header"
            title="Things"
            subTitle="All the things"
          />
          <TSListView
            list={things}
            editHandler={thing => {
              selectThing(thing);
              showModal("THING-FORM");
            }}
            deleteHandler={thing => {
              deleteThing(thing.id);
            }}
            itemAvatar={<PartitionOutlined />}
          />
        </div>
      )}
      {allSensors && (
        <div>
          <PageHeader
            className="site-page-header"
            title="Sensors"
            subTitle="All the sensors"
          />
          <TSListView
            list={allSensors}
            editHandler={sensor => {
              selectSensor(sensor);
              showModal("SENSOR-FORM");
            }}
            deleteHandler={sensor => {
              deleteSensor(sensor.id, sensor.thingID);
            }}
            itemAvatar={<BugOutlined />}
          />
        </div>
      )}
      {allActuators && (
        <div>
          <PageHeader
            className="site-page-header"
            title="Actuators"
            subTitle="All the actuator"
          />
          <TSListView
            list={allActuators}
            editHandler={actuator => {
              selectActuator(actuator);
              showModal("ACTUATOR-FORM");
            }}
            deleteHandler={actuator => {
              deleteActuator(actuator.id, actuator.thingID);
            }}
            itemAvatar={<BulbOutlined />}
          />
        </div>
      )}
      {dbConfig &&
        <div>
          <PageHeader
            className="site-page-header"
            title="Data Storage"
            subTitle="Configuration"
          />
        </div>
      }
    </div>
  );
};

export default ListView;
