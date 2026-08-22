import React from 'react';
import * as d3 from 'd3';

import { connect } from 'react-redux';
import { requestStats } from '../../actions';
import { isDataGenerator } from '../../utils';
import graphConfig from './GraphConfig';
import CustomNode from './CustomNode';

const NODE_BOX = 44;

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
      devType: 'GATEWAY',
      stats: thingStats,
    });
    const { sensors, actuators } = thing;
    if (sensors) {
      for (let sIndex = 0; sIndex < sensors.length; sIndex++) {
        const sensor = sensors[sIndex];
        const nodeID = `${thing.id}-${sensor.id}`;
        const sensorStats = thingStats ? getElementById(sensor.id, thingStats.sensorStats) : null;
        const numberOfData = sensorStats ? sensorStats.numberOfSentData : 0;
        nodes.push({
          id: nodeID,
          name: sensor.name,
          devType: 'SENSOR',
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
        const numberOfData = actuatorStats ? actuatorStats.numberOfReceivedData : 0;
        if (actuatorStats) {
          actuatorStats['status'] = thingStats.status;
          actuatorStats['startedTime'] = thingStats.startedTime;
        }
        nodes.push({
          id: nodeID,
          name: actuator.name,
          devType: 'ACTUATOR',
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

const linkKey = (source, target) => `${source}|${target}`;

const collectNeighbourhood = (links, id, degree) => {
  const neighbours = new Set();
  let frontier = id == null ? [] : [id];
  const seen = new Set(frontier);
  for (let step = 0; step < degree && frontier.length > 0; step++) {
    const next = [];
    for (const link of links) {
      let other = null;
      if (frontier.includes(link.source)) other = link.target;
      else if (frontier.includes(link.target)) other = link.source;
      if (other != null && !seen.has(other)) {
        seen.add(other);
        neighbours.add(other);
        next.push(other);
      }
    }
    frontier = next;
  }
  return neighbours;
};

export class GraphView extends React.Component {
  constructor(props) {
    super(props);
    const { model, stats } = this.props;
    this.containerRef = React.createRef();
    this.zoomAttachedEl = null;
    this.nodeEls = new Map();
    this.linkEls = new Map();
    this.simulation = null;
    this.simNodes = [];
    this.simLinks = [];
    this.positionCache = new Map();
    this.state = {
      data: buildGraphData(model, stats),
      hoverId: null,
      selectedId: null,
    };
  }

  componentDidMount() {
    const isDG = isDataGenerator();
    this.props.requestStats(isDG);
    if (this.props.simulationStatus) {
      this.timerId = setInterval(() => {
        this.props.requestStats(isDG);
      }, 5000);
    }
    this.syncGraph();
  }

  UNSAFE_componentWillReceiveProps(newProps) {
    const isDG = isDataGenerator();
    const { model, stats } = newProps;
    const data = buildGraphData(model, stats);
    this.setState({ data });
    if (newProps.simulationStatus) {
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

  componentDidUpdate(prevProps, prevState) {
    if (prevState.data !== this.state.data) this.syncGraph();
  }

  componentWillUnmount() {
    clearInterval(this.timerId);
    if (this.simulation) this.simulation.stop();
  }

  ensureSimulation() {
    if (this.simulation) return this.simulation;
    this.simulation = d3
      .forceSimulation(this.simNodes)
      .force(
        'link',
        d3
          .forceLink(this.simLinks)
          .id((d) => String(d.id))
          .distance(120)
      )
      .force('charge', d3.forceManyBody().strength(-250))
      .force(
        'collide',
        d3
          .forceCollide()
          .radius(NODE_BOX / 2)
          .iterations(2)
      )
      .force('center', d3.forceCenter(graphConfig.width / 2, graphConfig.height / 2))
      .on('tick', () => this.handleTick());
    return this.simulation;
  }

  handleTick() {
    for (const node of this.simNodes) {
      const el = this.nodeEls.get(String(node.id));
      if (el) el.setAttribute('transform', `translate(${node.x},${node.y})`);
    }
    for (const link of this.simLinks) {
      const el = this.linkEls.get(
        linkKey(link.source.id ?? link.source, link.target.id ?? link.target)
      );
      if (!el) continue;
      const x1 = link.source.x ?? 0;
      const y1 = link.source.y ?? 0;
      const x2 = link.target.x ?? 0;
      const y2 = link.target.y ?? 0;
      const dx = x2 - x1;
      const dy = y2 - y1;
      const len = Math.hypot(dx, dy) || 1;
      const trim = Math.min(NODE_BOX / 2, len / 2);
      const ex = x2 - (dx / len) * trim;
      const ey = y2 - (dy / len) * trim;
      const line = el.querySelector('line');
      if (line) {
        line.setAttribute('x1', x1);
        line.setAttribute('y1', y1);
        line.setAttribute('x2', ex);
        line.setAttribute('y2', ey);
      }
      const label = el.querySelector('text');
      if (label) {
        label.setAttribute('x', (x1 + ex) / 2);
        label.setAttribute('y', (y1 + ey) / 2 - 4);
      }
    }
  }

  syncGraph() {
    const data = this.state.data;
    const container = this.containerRef.current;
    if (!container || !data || data.nodes.length === 0) return;

    if (this.simulation) {
      for (const node of this.simNodes) {
        const { x, y, vx, vy, fx, fy } = node;
        this.positionCache.set(String(node.id), { x, y, vx, vy, fx, fy });
      }
    }

    const count = data.nodes.length;
    const radius = Math.min(graphConfig.width, graphConfig.height) / 3;
    this.simNodes = data.nodes.map((node, index) => ({
      ...node,
      ...(this.positionCache.get(String(node.id)) ?? {
        x: graphConfig.width / 2 + radius * Math.cos((2 * Math.PI * index) / count),
        y: graphConfig.height / 2 + radius * Math.sin((2 * Math.PI * index) / count),
      }),
    }));
    this.simLinks = data.links.map((link) => ({ ...link }));

    const simulation = this.ensureSimulation();
    simulation.nodes(this.simNodes);
    simulation.force('link').links(this.simLinks);
    simulation.alpha(1).restart();

    const svgSel = d3.select(container).select('svg');
    if (!svgSel.empty() && this.zoomAttachedEl !== svgSel.node()) {
      this.zoomAttachedEl = svgSel.node();
      const zoomRoot = svgSel.select('.topology-zoom-root');
      const zoomBehavior = d3
        .zoom()
        .scaleExtent([graphConfig.minZoom, graphConfig.maxZoom])
        .filter((event) => {
          const target = event.target;
          const onNode = target && target.closest && target.closest('.topology-node');
          if (onNode && event.type !== 'wheel') {
            return false;
          }
          return (!event.ctrlKey || event.type === 'wheel') && !event.button;
        })
        .on('zoom', (event) => {
          zoomRoot.attr('transform', event.transform);
        });
      svgSel.call(zoomBehavior).on('dblclick.zoom', null);
    }

    if (!this.dragBehavior) {
      this.dragBehavior = d3
        .drag()
        .on('start', (event, d) => {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on('drag', (event, d) => {
          d.fx = event.x;
          d.fy = event.y;
        })
        .on('end', (event, d) => {
          if (!event.active) simulation.alphaTarget(0);
        });
    }
    const simNodeById = new Map(this.simNodes.map((node) => [String(node.id), node]));
    container.querySelectorAll('.topology-node').forEach((el) => {
      const id = el.getAttribute('data-id');
      d3.select(el).datum(simNodeById.get(id)).call(this.dragBehavior);
    });
  }

  handleNodeHover(id) {
    this.setState({ hoverId: id });
  }

  handleNodeClick(id) {
    this.setState(({ selectedId }) => ({
      selectedId: selectedId === id ? null : id,
    }));
  }

  render() {
    const { data, hoverId, selectedId } = this.state;
    if (!data) return <p>Empty model</p>;
    const highlightCandidate =
      graphConfig.nodeHighlightBehavior && hoverId !== null ? hoverId : selectedId;
    const activeId =
      highlightCandidate != null && data.nodes.some((node) => node.id === highlightCandidate)
        ? highlightCandidate
        : null;
    const neighbours =
      activeId != null
        ? collectNeighbourhood(data.links, activeId, graphConfig.highlightDegree)
        : null;
    return (
      <div ref={this.containerRef}>
        <svg className="topology-svg" width={graphConfig.width} height={graphConfig.height}>
          <defs>
            <marker
              id="topology-arrow"
              viewBox="0 -5 10 10"
              refX="9"
              refY="0"
              markerWidth="8"
              markerHeight="8"
              orient="auto"
            >
              <path d="M0,-5L10,0L0,5" fill={graphConfig.link.color} />
            </marker>
            <marker
              id="topology-arrow-highlight"
              viewBox="0 -5 10 10"
              refX="9"
              refY="0"
              markerWidth="8"
              markerHeight="8"
              orient="auto"
            >
              <path d="M0,-5L10,0L0,5" fill={graphConfig.link.highlightColor} />
            </marker>
          </defs>
          <g className="topology-zoom-root">
            <g className="topology-links">
              {data.links.map((link) => {
                const incident =
                  activeId != null && (link.source === activeId || link.target === activeId);
                const dimmed = activeId != null && graphConfig.linkHighlightBehavior && !incident;
                const highlighted = incident && graphConfig.linkHighlightBehavior;
                return (
                  <g
                    key={linkKey(link.source, link.target)}
                    ref={(el) => {
                      const key = linkKey(link.source, link.target);
                      if (el) this.linkEls.set(key, el);
                      else this.linkEls.delete(key);
                    }}
                  >
                    <line
                      stroke={
                        highlighted ? graphConfig.link.highlightColor : graphConfig.link.color
                      }
                      strokeWidth={graphConfig.link.strokeWidth}
                      opacity={
                        dimmed
                          ? graphConfig.link.opacity * graphConfig.highlightOpacity
                          : graphConfig.link.opacity
                      }
                      markerEnd={
                        graphConfig.directed
                          ? highlighted
                            ? 'url(#topology-arrow-highlight)'
                            : 'url(#topology-arrow)'
                          : undefined
                      }
                    />
                    {graphConfig.link.renderLabel && (
                      <text
                        fontSize="10"
                        fill="#555"
                        textAnchor="middle"
                        style={{ pointerEvents: 'none' }}
                      >
                        {graphConfig.link.labelProperty(link)}
                      </text>
                    )}
                  </g>
                );
              })}
            </g>
            <g className="topology-nodes">
              {data.nodes.map((node) => {
                const dimmed = activeId != null && !neighbours.has(node.id) && node.id !== activeId;
                return (
                  <g
                    key={node.id}
                    data-id={String(node.id)}
                    className="topology-node"
                    style={{ cursor: 'pointer' }}
                    opacity={dimmed ? graphConfig.highlightOpacity : 1}
                    onMouseOver={() => this.handleNodeHover(node.id)}
                    onMouseOut={() => this.handleNodeHover(null)}
                    onClick={() => this.handleNodeClick(node.id)}
                    ref={(el) => {
                      if (el) this.nodeEls.set(String(node.id), el);
                      else this.nodeEls.delete(String(node.id));
                    }}
                  >
                    <foreignObject
                      width={NODE_BOX}
                      height={NODE_BOX}
                      x={-NODE_BOX / 2}
                      y={-NODE_BOX / 2}
                    >
                      <div
                        xmlns="http://www.w3.org/1999/xhtml"
                        style={{
                          width: NODE_BOX,
                          height: NODE_BOX,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <CustomNode data={node} />
                      </div>
                    </foreignObject>
                  </g>
                );
              })}
            </g>
          </g>
        </svg>
      </div>
    );
  }
}

const mapPropsToStates = ({ model, stats, simulationStatus }) => ({
  model,
  stats,
  simulationStatus,
});

const mapDispatchToProps = (dispatch) => ({
  requestStats: (isDG) => dispatch(requestStats(isDG)),
});

export default connect(mapPropsToStates, mapDispatchToProps)(GraphView);
