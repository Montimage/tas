import React, { Component } from "react";

import { Table, Dropdown, Button } from "antd";
import { DownOutlined } from "@ant-design/icons";
import EventModal from "../EventModal";
import { FormParagraphItem } from "../FormItems";
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
            render: (data) => (
              <FormParagraphItem
                value={data.sensorTopic}
                rows={1}
                expandable={true}
              />
            ),
            width: 350,
          },
          {
            title: "Values",
            key: "sensorValues",
            dataIndex: "sensorValues",
            render: (value) => {
              let showValue =
                typeof value === "string" ? value : JSON.stringify(value);
              return (
                <FormParagraphItem
                  value={showValue}
                  rows={1}
                  expandable={true}
                />
              );
            },
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
                return (
                  <FormParagraphItem
                    value={data.actuatorTopic}
                    rows={1}
                    expandable={true}
                  />
                );
              }
              return null;
            },
          },
          {
            title: "Values",
            key: "actuatorValues",
            dataIndex: "actuatorValues",
            render: (value) => {
              let showValue =
                typeof value === "string" ? value : JSON.stringify(value);
              return (
                <FormParagraphItem
                  value={showValue}
                  rows={1}
                  expandable={true}
                />
              );
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
          <React.Fragment>
            <Dropdown
              menu={{
                items: [
                  deleteEvent && {
                    key: "delete",
                    label: "Delete",
                    onClick: () => deleteEvent(event._id),
                  },
                  addNewEvent && {
                    key: "duplicate",
                    label: "Duplicate",
                    onClick: () => addNewEvent(event),
                  },
                  updateEvent && {
                    key: "mutate",
                    label: "Modify Value",
                    onClick: () => {
                      if (this.state.activeEventModal === null) {
                        this.changeActiveEventModal(event._id);
                      }
                    },
                  },
                ].filter(Boolean),
              }}
            >
              <Button>
                Select Action <DownOutlined />
              </Button>
            </Dropdown>
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
          </React.Fragment>
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
