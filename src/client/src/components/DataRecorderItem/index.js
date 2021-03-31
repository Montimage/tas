import React, { Fragment } from "react";
import { Button, Switch, Form, List, Typography, Card } from "antd";
import {
  PlusCircleOutlined,
  CloseCircleOutlined,
  CopyOutlined,
  WifiOutlined,
  AlertOutlined,
} from "@ant-design/icons";

import { FormEditableTextItem, FormSelectItem } from "../FormItems";
import ConnectionConfig from "../ConnectionConfig";
import CollapseForm from "../CollapseForm";

const { Text } = Typography;

const DataRecorderItem = ({
  data,
  onChange,
  onDelete,
  onDuplicate,
  onEnable,
}) => (
  <CollapseForm
    title={`${data.name}`}
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
      type="inner"
      style={{ marginBottom: 10 }}
      size="small"
      title="Overview"
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
      </Form>
    </Card>
    <Card
      type="inner"
      style={{ marginBottom: 10 }}
      size="small"
      title="Setup the Data Source"
    >
      <Form labelCol={{ span: 4 }} wrapperCol={{ span: 14 }}>
        <FormSelectItem
          label="Protocol"
          defaultValue={data.source.protocol}
          onChange={(v) => onChange("source.protocol", v)}
          options={["MQTT", "MQTTS"]}
        />
        <ConnectionConfig
          defaultValue={data.source.connConfig}
          dataPath={"source.connConfig"}
          onDataChange={onChange}
          type={data.source.protocol}
        />
      </Form>
    </Card>
    <Card
      type="inner"
      style={{ marginBottom: 10 }}
      size="small"
      title="Setup the Data Streams"
    >
      <List
        header={
          <strong>
            <WifiOutlined /> Sensor data streams ({data.source.upStreams.length}
            )
          </strong>
        }
        footer={
          <Button
            onClick={() => {
              const newUpStreams = [
                ...data.source.upStreams,
                `new-up-stream-${Date.now()}`,
              ];
              onChange("source.upStreams", newUpStreams);
            }}
          >
            <PlusCircleOutlined /> New sensor data stream
          </Button>
        }
        size="small"
        bordered
        dataSource={data.source.upStreams}
        renderItem={(item, index) => (
          <List.Item
            actions={[
              <Button
                size="small"
                danger
                key="delete"
                onClick={() => {
                  if (data.source.upStreams.length === 1) {
                    onChange("source.upStreams", []);
                  } else {
                    let newUpStreams = [...data.source.upStreams];
                    newUpStreams.splice(index, 1);
                    onChange("source.upStreams", newUpStreams);
                  }
                }}
              >
                <CloseCircleOutlined /> Delete
              </Button>,
            ]}
          >
            <Text
              editable={{
                onChange: (v) => onChange(`source.upStreams[${index}]`, v),
              }}
            >
              {item}
            </Text>
          </List.Item>
        )}
        style={{ marginBottom: 10 }}
      />
      <List
        header={
          <strong>
            <AlertOutlined /> Actuator data streams (
            {data.source.downStreams.length})
          </strong>
        }
        footer={
          <Button
            onClick={() => {
              const newDownStreams = [
                ...data.source.downStreams,
                `new-down-stream-${Date.now()}`,
              ];
              onChange("source.downStreams", newDownStreams);
            }}
          >
            <PlusCircleOutlined /> New actuator data stream
          </Button>
        }
        size="small"
        bordered
        dataSource={data.source.downStreams}
        renderItem={(item, index) => (
          <List.Item
            actions={[
              <Button
                size="small"
                danger
                key="delete"
                onClick={() => {
                  if (data.source.downStreams.length === 1) {
                    onChange("source.downStreams", []);
                  } else {
                    let newDownstreams = [...data.source.downStreams];
                    newDownstreams.splice(index, 1);
                    onChange("source.downStreams", newDownstreams);
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
                onChange: (v) => onChange(`source.downStreams[${index}]`, v),
              }}
            >
              {item}
            </Text>
          </List.Item>
        )}
      />
    </Card>
    <Card
      type="inner"
      style={{ marginBottom: 10 }}
      size="small"
      title="Setup connection to Testing Target (Live-Streaming mode)"
    >
      {data.forward ? (
        <Form labelCol={{ span: 4 }} wrapperCol={{ span: 14 }}>
          <FormSelectItem
            label="Protocol"
            defaultValue={data.forward.protocol}
            onChange={(v) => onChange("forward.protocol", v)}
            options={["MQTT", "MQTTS"]}
          />
          <ConnectionConfig
            defaultValue={data.forward.connConfig}
            dataPath={"forward.connConfig"}
            onDataChange={onChange}
            type={data.forward.protocol}
          />
          <Button danger onClick={() => onChange("forward", null)}>
            <CloseCircleOutlined /> Remove Testing Target
          </Button>
        </Form>
      ) : (
        <Button
          onClick={() =>
            onChange("forward", {
              protocol: "MQTT",
              connConfig: {
                host: "localhost",
                port: 1883,
                options: null,
              },
            })
          }
        >
          <PlusCircleOutlined /> Setup Testing Target
        </Button>
      )}
    </Card>
  </CollapseForm>
);

export default DataRecorderItem;
