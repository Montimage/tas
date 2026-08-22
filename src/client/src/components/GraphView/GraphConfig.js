export default {
  directed: true,
  width: 800,
  height: 400,
  minZoom: 0.5,
  maxZoom: 3,
  highlightDegree: 1,
  highlightOpacity: 0.2,
  nodeHighlightBehavior: true,
  linkHighlightBehavior: true,
  link: {
    color: "#d3d3d3",
    opacity: 1,
    strokeWidth: 2,
    highlightColor: "blue",
    renderLabel: true,
    labelProperty: (link) => link.numberOfData,
  },
};
