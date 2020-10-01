import React, { Component, Fragment } from "react";
import { connect } from "react-redux";
import { Table, Menu, Dropdown, Button, Tooltip, Form } from "antd";
import { DownOutlined } from "@ant-design/icons";
import LayoutPage from "./LayoutPage";
import {
  requestDataset,
  requestAddNewDataset,
  requestUpdateDataset,
  requestEventsByDatasetId,
  requestAddNewEvent,
  requestDeleteEvent,
  requestUpdateEvent,
} from "../actions";
import {
  FormEditableTextItem,
  FormSelectItem,
  FormTextNotEditableItem,
} from "../components/FormItems";
import { getLastPath } from "../utils";
import EventModal from "../components/EventModal";
import EventStream from "../components/EventStream/EventStream";

/**
 * - id
- name
- tags
- description
- createdAt/ lastModified
- source:
   + GENERATED
   + MUTATED
   + RECORDED

 */

const initEvent = (dsId) => ({
  _id: `new-event-id`,
  timestamp: Date.now(),
  topic: `topic-${Date.now()}`,
  isSensorData: false,
  values: `values-${Date.now()}`,
  datasetId: dsId,
});

class DatasetPage extends Component {
  constructor(props) {
    super(props);
    const { dataset } = props;
    if (dataset) {
      const {
        id,
        name,
        description,
        tags,
        createdAt,
        lastModified,
        source,
      } = dataset;
      this.state = {
        id,
        originalId: id,
        name,
        description,
        tags,
        createdAt,
        lastModified,
        source,
        isChanged: false,
        events: [],
        isNew: false,
        newEvent: initEvent(id),
        activeEventModal: null,
      };
    } else {
      const currentTime = Date.now();
      const dsId = getLastPath();
      this.state = {
        id: dsId,
        originalId: null,
        name: `new-dataset-${currentTime}-name`,
        description: `new-dataset-${currentTime}-description`,
        tags: [],
        createdAt: currentTime,
        lastModified: currentTime,
        source: "GENERATED",
        isChanged: true,
        isNew: true,
        events: [],
        newEvent: initEvent(dsId),
        activeEventModal: null,
      };
    }
  }

  componentDidMount() {
    const dsId = getLastPath();
    this.props.fetchDataset(dsId);
    this.props.fetchEvents(dsId);
  }

  componentWillReceiveProps(newProps) {
    const { dataset, events } = newProps;
    if (dataset) {
      const {
        id,
        name,
        description,
        tags,
        createdAt,
        lastModified,
        source,
      } = dataset;
      this.setState({
        id,
        originalId: id,
        name,
        description,
        tags,
        createdAt,
        lastModified,
        source,
        isChanged: false,
        isNew: false,
        activeEventModal: null,
      });
    }

    if (events) {
      this.setState({ events });
    }
  }

  moveEventUp(index) {
    const { events } = this.state;
    let newEvents = [...events];
    const selectDS = newEvents[index];
    newEvents[index] = newEvents[index - 1];
    newEvents[index - 1] = selectDS;
    this.setState({ events: newEvents, isChanged: true });
  }

  moveEventDown(index) {
    const { events } = this.state;
    let newEvents = [...events];
    const selectDS = newEvents[index];
    newEvents[index] = newEvents[index + 1];
    newEvents[index + 1] = selectDS;
    this.setState({ events: newEvents, isChanged: true });
  }

  updateId(newId) {
    if (newId !== this.state.originalId) {
      this.setState({ id: newId, isChanged: true, newEvent: initEvent(newId) });
    }
  }
  updateName(newName) {
    this.setState({ name: newName, isChanged: true });
  }

  updateDescription(newDescription) {
    this.setState({ description: newDescription, isChanged: true });
  }

  updateSource(newSource) {
    this.setState({ source: newSource, isChanged: true });
  }

  updateTags(newTags) {
    this.setState({ tags: JSON.parse(newTags), isChanged: true });
  }

  savedataset() {
    const {
      id,
      name,
      description,
      tags,
      source,
      datasetIds,
      originalId,
      isNew,
    } = this.state;
    if (isNew) {
      this.props.addNewdataset({
        id,
        name,
        description,
        tags,
        source,
        datasetIds,
      });
      this.setState({ isChanged: false, isNew: false, originalId: id });
    } else {
      this.props.updatedataset(originalId, {
        id,
        name,
        description,
        tags,
        source,
        datasetIds,
      });
      this.setState({ isChanged: false, originalId: id });
    }
  }

  changeActiveEventModal(id) {
    this.setState({ activeEventModal: id });
  }

  render() {
    const {
      id,
      name,
      description,
      tags,
      source,
      events,
      isChanged,
      newEvent,
      isNew,
    } = this.state;
    const { deleteEvent, addNewEvent, updateEvent } = this.props;
    const nbEvents = events.length;
    const startTime = events[0] ? events[0].timestamp : 0;
    const endTime = events[nbEvents - 1] ? events[nbEvents - 1].timestamp : 0;
    const nbSensors = events.filter((e) => e.isSensorData).length;
    const nbActuators = events.length - nbSensors;
    // TODO: improve the tags view: https://ant.design/components/tag/
    // - color
    // - action remove/add new tags
    // Statistic on events data
    // - Total number of events
    // - Number of sensors
    // - Number of actuators
    // - Number of gateway
    // - Started time/ End time
    // - Source: recorded, generated, etc..

    // TODO: Make statistic beautiful
    // TODO: implement editting event
    return (
      <LayoutPage
        pageTitle={name}
        pageSubTitle="View and update the test case detail"
      >
        <Form labelCol={{ span: 8 }} wrapperCol={{ span: 16 }}>
          {isNew ? (
            <Fragment>
              <FormEditableTextItem
                label="Id"
                defaultValue={id}
                onChange={(newId) => this.updateId(newId)}
              />
              <FormSelectItem
                label="Source"
                defaultValue={source}
                options={["GENERATED", "MUTATED", "RECORDED"]}
                onChange={(newSource) => this.updateSource(newSource)}
              />
            </Fragment>
          ) : (
            <Fragment>
              <FormTextNotEditableItem label="Id" value={id} />
              <FormTextNotEditableItem label="Source" value={source} />
            </Fragment>
          )}

          <FormEditableTextItem
            label="Name"
            defaultValue={name}
            onChange={(newName) => this.updateName(newName)}
          />
          <FormEditableTextItem
            label="Description"
            defaultValue={description}
            onChange={(newDescription) =>
              this.updateDescription(newDescription)
            }
          />
          <FormEditableTextItem
            label="Tags"
            defaultValue={JSON.stringify(tags)}
            onChange={(newTags) => this.updateTags(newTags)}
          />
          <FormTextNotEditableItem label="Number of events" value={nbEvents} />
          <FormTextNotEditableItem
            label="Number of sensor's events"
            value={nbSensors}
          />
          <FormTextNotEditableItem
            label="Number of actuator's events"
            value={nbActuators}
          />
          <FormTextNotEditableItem
            label="Started Time"
            value={new Date(startTime).toLocaleString()}
          />
          <FormTextNotEditableItem
            label="Ended Time"
            value={new Date(endTime).toLocaleString()}
          />
        </Form>
        <Tooltip title="The dataset need to be created before adding event">
          <Button
            style={{ marginBottom: "10px" }}
            onClick={() => {
              if (this.state.activeEventModal === null) {
                this.changeActiveEventModal(newEvent._id);
              }
            }}
            disabled={isNew ? true : false}
          >
            Add Event
            <EventModal
              event={newEvent}
              enable={newEvent._id === this.state.activeEventModal}
              onCancel={() => {
                this.changeActiveEventModal(null);
              }}
              onOK={(newEvent) => {
                const {
                  timestamp,
                  isSensorData,
                  topic,
                  datasetId,
                  values,
                } = newEvent;
                this.props.addNewEvent({
                  timestamp,
                  isSensorData,
                  topic,
                  datasetId,
                  values,
                });
                this.changeActiveEventModal(null);
              }}
            />
          </Button>
        </Tooltip>
        <EventStream
          events={events}
          deleteEvent={deleteEvent}
          addNewEvent={addNewEvent}
          updateEvent={updateEvent}
        />
        <Button
          onClick={() => this.savedataset()}
          disabled={isChanged ? false : true}
          type="primary"
          size="large"
          style={{
            position: "fixed",
            top: 80,
            right: 20,
          }}
          disabled={isChanged ? false : true}
        >
          Save
        </Button>
      </LayoutPage>
    );
  }
}

const mapPropsToStates = ({ datasets }) => ({
  dataset: datasets.currentDataset.dataset,
  events: datasets.currentDataset.events,
});

const mapDispatchToProps = (dispatch) => ({
  fetchEvents: (datasetId) => dispatch(requestEventsByDatasetId(datasetId)),
  fetchDataset: (datasetId) => dispatch(requestDataset(datasetId)),
  updatedataset: (originalId, updateddataset) =>
    dispatch(
      requestUpdateDataset({
        id: originalId,
        dataset: updateddataset,
      })
    ),
  addNewdataset: (dataset) => dispatch(requestAddNewDataset(dataset)),
  addNewEvent: (event) => dispatch(requestAddNewEvent(event)),
  updateEvent: (id, event) => dispatch(requestUpdateEvent({ id, event })),
  deleteEvent: (eventId) => dispatch(requestDeleteEvent(eventId)),
});

export default connect(mapPropsToStates, mapDispatchToProps)(DatasetPage);

// TODO: load more data in the table
