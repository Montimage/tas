import React from "react";

import { Graph } from "react-d3-graph";

import { connect } from "react-redux";
import { requestStats } from "../../actions";
import { isDataGenerator } from "../../utils";
import graphConfig from "./GraphConfig";

const getElementById = (id, array) => {
  if (!array || array.length === 0) return null;
  for (let index = 0; index < array.length; index++) {
    const element = array[index];
    if (element.id === id) return element;
  }
  return null;
};

const buildGraphData = (model, stats) => {
  const { things } = model;
  if (!things || things.length === 0) return null;
  const nodes = [];
  const links = [];
  for (let index = 0; index < things.length; index++) {
    const thing = things[index];
    const thingStats = getElementById(thing.id, stats);
    nodes.push({
      id: thing.id,
      name: thing.name,
      devType: "GATEWAY",
      stats: thingStats,
    });
    const { sensors, actuators } = thing;
    if (sensors) {
      for (let sIndex = 0; sIndex < sensors.length; sIndex++) {
        const sensor = sensors[sIndex];
        const nodeID = `${thing.id}-${sensor.id}`;
        const sensorStats = thingStats
          ? getElementById(sensor.id, thingStats.sensorStats)
          : null;
        const numberOfData = sensorStats ? sensorStats.numberOfSentData : 0;
        nodes.push({
          id: nodeID,
          name: sensor.name,
          devType: "SENSOR",
          stats: sensorStats,
        });
        links.push({ source: nodeID, target: thing.id, numberOfData });
      }
    }
    if (actuators) {
      for (let sIndex = 0; sIndex < actuators.length; sIndex++) {
        const actuator = actuators[sIndex];
        const nodeID = `${thing.id}-${actuator.id}`;
        const actuatorStats = thingStats
          ? getElementById(actuator.id, thingStats.actuatorStats)
          : null;
        const numberOfData = actuatorStats
          ? actuatorStats.numberOfReceivedData
          : 0;
        if (actuatorStats) {
          actuatorStats["status"] = thingStats.status;
          actuatorStats["startedTime"] = thingStats.startedTime;
        }
        nodes.push({
          id: nodeID,
          name: actuator.name,
          devType: "ACTUATOR",
          stats: actuatorStats,
        });
        links.push({
          source: thing.id,
          target: nodeID,
          numberOfData,
        });
      }
    }
  }
  return { nodes, links };
};

class GraphView extends React.Component {
  constructor(props) {
    super(props);
    const { model, stats } = this.props;
    const data = buildGraphData(model, stats);
    this.state = {
      data,
    };
  }
  componentDidMount() {
    const isDG = isDataGenerator();
    this.props.requestStats(isDG);
    console.log(this.timerId);
    if (this.props.deployStatus) {
      this.timerId = setInterval(() => {
        this.props.requestStats(isDG);
      }, 5000);
    }
  }

  componentWillReceiveProps(newProps) {
    const isDG = isDataGenerator();
    console.log(this.timerId);
    const { model, stats } = newProps;
    const data = buildGraphData(model, stats);
    this.setState({ data });
    if (newProps.deployStatus) {
      if (!this.timerId) {
        newProps.requestStats(isDG);
        this.timerId = setInterval(() => {
          newProps.requestStats(isDG);
        }, 5000);
      }
    } else if (this.timerId) {
      clearInterval(this.timerId);
    }
  }

  componentWillUnmount() {
    clearInterval(this.timerId);
  }

  render() {
    const { data } = this.state;
    if (!data) return <p>Empty model</p>;
    console.log(data);
    return (
      <Graph
        id="graph-id" // id is mandatory, if no id is defined rd3g will throw an error
        data={data}
        config={graphConfig}
      />
    );
  }
}

const mapPropsToStates = ({ model, stats, deployStatus }) => ({
  model,
  stats,
  deployStatus,
});

const mapDispatchToProps = (dispatch) => ({
  requestStats: (isDG) => dispatch(requestStats(isDG)),
});

export default connect(mapPropsToStates, mapDispatchToProps)(GraphView);
