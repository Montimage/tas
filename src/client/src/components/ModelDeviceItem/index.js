import React, { Fragment } from "react";
import { Button, Switch, Form, List, Typography, Card } from "antd";
// all the edit forms
import SensorModal from "../SensorModal";
import ActuatorModal from "../ActuatorModal";

import {
  PlusCircleOutlined,
  CloseCircleOutlined,
  CopyOutlined,
  EditOutlined,
  AlertOutlined,
  WifiOutlined,
} from "@ant-design/icons";
import {
  FormEditableTextItem,
  FormNumberItem,
  FormSelectItem,
} from "../FormItems";
import ConnectionConfig from "../ConnectionConfig";
import CollapseForm from "../CollapseForm";

const { Text } = Typography;

const addNewSensor = () => {
  const currentTime = Date.now();
  return {
    id: `sensor-id-${currentTime}`,
    objectId: null,
    name: `New sensor ${currentTime}`,
    enable: true,
    isFromDatabase: false,
    topic: `sensors/topic/${currentTime}`,
    scale: 1,
    dataSource: "DATA_SOURCE_DATASET",
    replayOptions: null,
    dataSpecs: {
      timePeriod: 5,
      scale: 1,
      dosAttackSpeedUpRate: 5,
      timeBeforeFailed: 20,
      sensorBehaviours: [],
      withEnergy: false,
      isIPSOFormat: false,
      energy: null,
      sources: [],
    },
  };
};

const addNewActuator = () => {
  const currentTime = Date.now();
  return {
    id: `actuator-id-${currentTime}`,
    objectId: null,
    name: `New actuator ${currentTime}`,
    enable: true,
    topic: `actuators/topic/${currentTime}`,
    scale: 1,
  };
};

const ModelDeviceItem = ({
  data,
  onChange,
  onDelete,
  onDuplicate,
  changeModalId,
  selectedModalId,
  onEnable,
}) => (
  <CollapseForm
    title={`${data.name} ${data.scale > 1 ? `(${data.scale} instances)` : ""}`}
    extra={
      <Fragment>
        <Switch
          defaultChecked={data.enable ? true : false}
          checkedChildren="Enable"
          unCheckedChildren="Disable"
          onClick={(value, event) => {
            event.stopPropagation();
            onEnable();
          }}
          style={{ marginRight: 10 }}
        />
        <Button
          onClick={(event) => {
            event.stopPropagation();
            onDuplicate();
          }}
          size="small"
          style={{ marginRight: 10 }}
        >
          <CopyOutlined /> Duplicate
        </Button>
        <Button
          onClick={(event) => {
            event.stopPropagation();
            onDelete();
          }}
          size="small"
          danger
        >
          <CloseCircleOutlined /> Delete
        </Button>
      </Fragment>
    }
  >
    <Card
      size="small"
      type="inner"
      title="Device Overview"
      style={{ marginBottom: 10 }}
    >
      <Form labelCol={{ span: 4 }} wrapperCol={{ span: 14 }}>
        <FormEditableTextItem
          label="Name"
          defaultValue={data.name}
          onChange={(newName) => onChange("name", newName)}
        />
        <FormEditableTextItem
          label="Id"
          defaultValue={data.id}
          onChange={(newId) => onChange("id", newId)}
        />
        <FormNumberItem
          label="Scale"
          defaultValue={data.scale}
          min={1}
          max={1000}
          onChange={(newScale) => onChange("scale", newScale)}
        />
      </Form>
    </Card>
    <Card
      size="small"
      type="inner"
      title="Setup connection to Testing Target"
      style={{ marginBottom: 10 }}
    >
      <Form labelCol={{ span: 4 }} wrapperCol={{ span: 14 }}>
        <FormSelectItem
          label="Protocol"
          defaultValue={data.testBroker.protocol}
          onChange={(v) => onChange("testBroker.protocol", v)}
          options={["MQTT", "MQTTS", "AZURE_IOT_DEVICE"]}
        />
        <ConnectionConfig
          defaultValue={data.testBroker.connConfig}
          dataPath={"testBroker.connConfig"}
          onDataChange={onChange}
          type={data.testBroker.protocol}
        />
      </Form>
    </Card>
    <Card
      size="small"
      type="inner"
      title="Setup connection to the Real System"
      style={{ marginBottom: 10 }}
    >
      {data.productionBroker ? (
        <Form labelCol={{ span: 4 }} wrapperCol={{ span: 14 }}>
          <FormSelectItem
            label="Protocol"
            defaultValue={data.productionBroker.protocol}
            onChange={(v) => onChange("productionBroker.protocol", v)}
            options={["MQTT", "MQTTS", "AZURE_IOT_DEVICE"]}
          />
          <ConnectionConfig
            defaultValue={data.productionBroker.connConfig}
            dataPath={"productionBroker.connConfig"}
            onDataChange={onChange}
            type={data.productionBroker.protocol}
          />
          <Button
            danger
            onClick={() => onChange("productionBroker", null)}
            style={{ marginLeft: 10 }}
          >
            <CloseCircleOutlined /> Remove Production Broker
          </Button>
        </Form>
      ) : (
        <Button
          onClick={() =>
            onChange("productionBroker", {
              protocol: "MQTT",
              connConfig: {
                host: "localhost",
                port: 1883,
                options: null,
              },
            })
          }
          style={{ marginLeft: 10 }}
        >
          <PlusCircleOutlined /> Add Production Broker
        </Button>
      )}
    </Card>
    <Card
      size="small"
      type="inner"
      title="Sensors and Actuators"
      style={{ marginBottom: 10 }}
      extra={
        <Switch
          checkedChildren="Stream Replaying"
          unCheckedChildren="Simulation Mode"
          checked={data.isReplayingStreams}
          onChange={(v) => onChange("isReplayingStreams", v)}
        />
      }
    >
      {data.isReplayingStreams ? (
        <Fragment>
          <List
            header={
              <strong>
                <WifiOutlined /> Sensor data streams ({data.upStreams.length})
              </strong>
            }
            footer={
              <Button
                onClick={() => {
                  const newUpStreams = [
                    ...data.upStreams,
                    `new-up-stream-${Date.now()}`,
                  ];
                  onChange("upStreams", newUpStreams);
                }}
              >
                <PlusCircleOutlined /> Add New UpStream
              </Button>
            }
            size="small"
            bordered
            dataSource={data.upStreams}
            renderItem={(item, index) => (
              <List.Item
                actions={[
                  <Button
                    size="small"
                    danger
                    key="delete"
                    onClick={() => {
                      if (data.upStreams.length === 1) {
                        onChange("upStreams", []);
                      } else {
                        let newUpStreams = [...data.upStreams];
                        newUpStreams.splice(index, 1);
                        onChange("upStreams", newUpStreams);
                      }
                    }}
                  >
                    <CloseCircleOutlined /> Delete
                  </Button>,
                ]}
              >
                <Text
                  editable={{
                    onChange: (v) => onChange(`upStreams[${index}]`, v),
                  }}
                >
                  {item}
                </Text>
              </List.Item>
            )}
          />
          <p></p>
          <List
            header={
              <strong>
                {" "}
                <AlertOutlined /> Actuator data streams (
                {data.downStreams.length})
              </strong>
            }
            footer={
              <Button
                onClick={() => {
                  const newDownStreams = [
                    ...data.downStreams,
                    `new-down-stream-${Date.now()}`,
                  ];
                  onChange("downStreams", newDownStreams);
                }}
              >
                <PlusCircleOutlined /> Add New DownStream
              </Button>
            }
            size="small"
            bordered
            dataSource={data.downStreams}
            renderItem={(item, index) => (
              <List.Item
                actions={[
                  <Button
                    size="small"
                    danger
                    key="delete"
                    onClick={() => {
                      if (data.downStreams.length === 1) {
                        onChange("downStreams", []);
                      } else {
                        let newDownstreams = [...data.downStreams];
                        newDownstreams.splice(index, 1);
                        onChange("downStreams", newDownstreams);
                      }
                    }}
                  >
                    <CloseCircleOutlined /> Delete
                  </Button>,
                ]}
              >
                <Text
                  value={item}
                  editable={{
                    onChange: (v) => onChange(`downStreams[${index}]`, v),
                  }}
                >
                  {item}
                </Text>
              </List.Item>
            )}
          />
        </Fragment>
      ) : (
        <Fragment>
          <List
            header={
              <strong>
                <WifiOutlined /> Sensors (
                {data.sensors.reduce((nbSensor, s) => {
                  return s.dataSpecs.scale
                    ? nbSensor + Number(s.dataSpecs.scale)
                    : nbSensor++;
                }, 0)}
                )
              </strong>
            }
            footer={
              <Button
                onClick={() => {
                  const newSensor = addNewSensor();
                  if (data.sensors.length === 0) {
                    onChange("sensors", [newSensor]);
                  } else {
                    // const newSensors = [...data.sensors, newSensor];
                    onChange(`sensors[${data.sensors.length}]`, newSensor);
                  }
                }}
              >
                <PlusCircleOutlined /> Add New Sensor
              </Button>
            }
            size="small"
            bordered
            dataSource={data.sensors}
            renderItem={(item, index) => (
              <List.Item
                actions={[
                  <Switch
                    checkedChildren="Enable"
                    unCheckedChildren="Disable"
                    defaultChecked={item.enable ? true : false}
                    onChange={() =>
                      onChange(`sensors[${index}].enable`, !item.enable)
                    }
                  />,
                  <Button
                    size="small"
                    key="edit"
                    onClick={() => changeModalId(item.id)}
                  >
                    <EditOutlined /> Edit
                  </Button>,
                  <Button
                    size="small"
                    key="duplicate"
                    onClick={() => {
                      const newSensor = {
                        ...item,
                        id: `${item.id}-duplicated`,
                        name: `${item.name} [duplicaed]`,
                      };
                      let newSensors = [...data.sensors, newSensor];
                      onChange("sensors", newSensors);
                    }}
                  >
                    <CopyOutlined /> Duplicate
                  </Button>,
                  <Button
                    size="small"
                    danger
                    key="delete"
                    onClick={() => {
                      if (data.sensors.length === 1) {
                        onChange("sensors", []);
                      } else {
                        let newSensors = [...data.sensors];
                        newSensors.splice(index, 1);
                        onChange("sensors", newSensors);
                      }
                    }}
                  >
                    <CloseCircleOutlined /> Delete
                  </Button>,
                ]}
              >
                <Text>
                  {item.name} ({item.dataSpecs.scale ? item.dataSpecs.scale : 1}
                  )
                </Text>
                <SensorModal
                  enable={selectedModalId === item.id}
                  sensorData={item}
                  deviceId={data.id}
                  onOK={(dataPath, value) =>
                    onChange(`sensors[${index}].${dataPath}`, value)
                  }
                  onClose={() => {
                    changeModalId(null);
                  }}
                />
              </List.Item>
            )}
            style={{ marginBottom: 10 }}
          />
          <List
            header={
              <strong>
                <AlertOutlined /> Actuators (
                {data.actuators.reduce(
                  (nbA, a) => (a.scale ? nbA + Number(a.scale) : nbA++),
                  0
                )}
                )
              </strong>
            }
            footer={
              <Button
                onClick={() => {
                  const newActuator = addNewActuator();
                  if (data.actuators.length === 0) {
                    onChange("actuators", [newActuator]);
                  } else {
                    // const newActuators = [...data.actuators, newActuator];
                    onChange(
                      `actuators[${data.actuators.length}]`,
                      newActuator
                    );
                  }
                }}
              >
                <PlusCircleOutlined /> Add New Actuator
              </Button>
            }
            size="small"
            bordered
            dataSource={data.actuators}
            renderItem={(item, index) => (
              <List.Item
                actions={[
                  <Switch
                    checkedChildren="Enable"
                    unCheckedChildren="Disable"
                    defaultChecked={item.enable ? true : false}
                    onChange={() =>
                      onChange(`actuators[${index}].enable`, !item.enable)
                    }
                  />,
                  <Button
                    size="small"
                    key="edit"
                    onClick={() => changeModalId(item.id)}
                  >
                    <EditOutlined /> Edit
                  </Button>,
                  <Button
                    size="small"
                    key="duplicate"
                    onClick={() => {
                      const newActuator = {
                        ...item,
                        id: `${item.id}-duplicated`,
                        name: `${item.name} [duplicaed]`,
                      };
                      let newActuators = [...data.actuators, newActuator];
                      onChange("actuators", newActuators);
                    }}
                  >
                    <CopyOutlined /> Duplicate
                  </Button>,
                  <Button
                    size="small"
                    danger
                    key="delete"
                    onClick={() => {
                      if (data.actuators.length === 1) {
                        onChange("actuators", []);
                      } else {
                        let newActuators = [...data.actuators];
                        newActuators.splice(index, 1);
                        onChange("actuators", newActuators);
                      }
                    }}
                  >
                    <CloseCircleOutlined /> Delete
                  </Button>,
                ]}
              >
                <Text>
                  {item.name} ({item.scale ? item.scale : 1})
                </Text>
                <ActuatorModal
                  enable={selectedModalId === item.id}
                  actuatorData={item}
                  deviceId={data.id}
                  onOK={(dataPath, value) =>
                    onChange(`actuators[${index}].${dataPath}`, value)
                  }
                  onClose={() => {
                    changeModalId(null);
                  }}
                />
              </List.Item>
            )}
          />
        </Fragment>
      )}
    </Card>
  </CollapseForm>
);

export default ModelDeviceItem;
