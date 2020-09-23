import React, { Component } from "react";

import { Table, Menu, Dropdown, Button, Typography } from "antd";
import { DownOutlined } from "@ant-design/icons";
import EventModal from "../EventModal";
const { Text } = Typography;
class EventStream extends Component {
  constructor(props) {
    super(props);
    this.state = {
      activeEventModal: null,
    };
  }

  changeActiveEventModal(id) {
    this.setState({ activeEventModal: id });
  }

  render() {
    const { events, deleteEvent, addNewEvent, updateEvent, title } = this.props;
    let sensors = [];
    let actuators = [];
    let sensorTopicFilters = [];
    let actuatorTopicFilters = [];
    const eventStreams = [];
    let startTime = 0;
    if (events.length > 0) startTime = events[0].timestamp;
    for (let index = 0; index < events.length; index++) {
      const event = events[index];
      if (event.isSensorData) {
        eventStreams.push({
          ...event,
          viewTime: event.timestamp - startTime,
          key: index,
          sensorValues: event.values,
          sensorTopic: event.topic,
        });
        if (sensors.indexOf(event.topic) === -1) {
          sensors.push(event.topic);
          sensorTopicFilters.push({ text: event.topic, value: event.topic });
        }
      } else {
        eventStreams.push({
          ...event,
          viewTime: event.timestamp - startTime,
          key: index,
          actuatorValues: event.values,
          actuatorTopic: event.topic,
        });
        if (actuators.indexOf(event.topic) === -1) {
          // This is a new actuator
          actuators.push(event.topic);
          actuatorTopicFilters.push({ text: event.topic, value: event.topic });
        }
      }
    }

    const columns = [
      {
        title: "Index",
        key: "index",
        dataIndex: "key",
        render: (ts) => ts,
        width: 50,
      },
      {
        title: "Timestamp",
        key: "timestamp",
        dataIndex: "timestamp",
        sorter: (a, b) => a.timestamp - b.timestamp,
        render: (ts) => ts,
        width: 150,
      },
      {
        title: "Time",
        key: "viewTime",
        dataIndex: "viewTime",
        sorter: (a, b) => a.viewTime - b.viewTime,
        render: (ts) => ts,
        width: 150,
      },
      {
        title: `Sensor (${sensors.length})`,
        children: [
          {
            title: "Topic",
            key: "sensorTopic",
            filters: sensorTopicFilters,
            onFilter: (value, data) => data.sensorTopic === value,
            render: (data) => data.sensorTopic,
            width: 350,
          },
          {
            title: "Values",
            key: "sensorValues",
            dataIndex: "sensorValues",
            render: (value) => JSON.stringify(value),
          },
        ],
      },
      {
        title: `Actuator (${actuators.length})`,
        children: [
          {
            title: "Topic",
            key: "actuatorTopic",
            filters: actuatorTopicFilters,
            onFilter: (value, data) => data.actuatorTopic === value,
            width: 350,
            render: (data) => {
              if (data.actuatorTopic) {
                return <Text mark>{data.actuatorTopic}</Text>;
              }
              return null;
            },
          },
          {
            title: "Values",
            key: "actuatorValues",
            dataIndex: "actuatorValues",
            render: (value) => {
              if (value) {
                return <Text mark>{JSON.stringify(value)}</Text>;
              }
              return null;
            },
          },
        ],
      },
    ];
    if (deleteEvent || addNewEvent || updateEvent) {
      columns.push({
        title: "Action",
        key: "data",
        width: 100,
        render: (event) => (
          <Dropdown
            overlay={
              <Menu>
                {deleteEvent && (
                  <Menu.Item
                    key="delete"
                    onClick={() => deleteEvent(event._id)}
                  >
                    Delete
                  </Menu.Item>
                )}
                {addNewEvent && (
                  <Menu.Item key="duplicate" onClick={() => addNewEvent(event)}>
                    Duplicate
                  </Menu.Item>
                )}
                {updateEvent && (
                  <Menu.Item
                    key="mutate"
                    onClick={() => {
                      if (this.state.activeEventModal === null) {
                        this.changeActiveEventModal(event._id);
                      }
                    }}
                  >
                    Modify Value
                    <EventModal
                      event={event}
                      enable={event._id === this.state.activeEventModal}
                      onCancel={() => {
                        this.changeActiveEventModal(null);
                      }}
                      onOK={(newEvent) => {
                        updateEvent(event._id, newEvent);
                        this.changeActiveEventModal(null);
                      }}
                    />
                  </Menu.Item>
                )}
              </Menu>
            }
          >
            <a
              className="ant-dropdown-link"
              onClick={(e) => e.preventDefault()}
            >
              <Button>
                Select Action <DownOutlined />
              </Button>
            </a>
          </Dropdown>
        ),
      });
    }
    if (title) {
      return (
        <Table
          bordered
          columns={columns}
          dataSource={eventStreams}
          title={() => title}
        />
      );
    } else {
      return <Table bordered columns={columns} dataSource={eventStreams} />;
    }
  }
}

export default EventStream;
