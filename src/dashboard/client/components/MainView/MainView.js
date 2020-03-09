import React, { Component } from "react";
import { connect } from "react-redux";
import { Button } from "antd";

import { requestModel, setModel, uploadModel } from "../../actions";
import JSONView from "../JSONView";
import GraphView from "./GraphView";
import ListView from "./ListView";
// import 'jsoneditor-react/es/editor.min.css';
import "./styles.css";

// console.log(ace.acequire('editor'));
class MainView extends Component {
  constructor(props) {
    super(props);
    this.state = {
      tempModel: props.model
    };
    this.onModelChange = this.onModelChange.bind(this);
  }

  componentDidMount() {
    this.props.fetchModel();
  }

  componentWillReceiveProps(newProps) {
    this.setState({
      tempModel: newProps.model
    })
  }

  onModelChange(newModel) {
    this.setState({
      tempModel: newModel
    });
  }

  render() {
    const { requesting, view, error, model, logs, saveModel } = this.props;
    return (
      <div className="content">
        {requesting ? (
          <span>Loading ...</span>
        ) : error ? (
          <span> There are some error {error}</span>
        ) : view.contentType === "logs" ? (
          <p>{logs}</p>
        ) : (
          <div>
            {view.viewType === "json" ? (
              <JSONView value={model} onChange={this.onModelChange} />
            ) : view.viewType === "graph" ? (
              <GraphView value={model} onChange={this.onModelChange} />
            ) : (
              <ListView value={model} onChange={this.onModelChange} />
            )}
            <Button
              type="default"
              shape="round"
              onClick={() => saveModel(this.state.tempModel)}
              style={{ marginTop: "10px" }}
            >
              Save
            </Button>
          </div>
        )}
      </div>
    );
  }
}

const mapPropsToStates = ({ requesting, view, error, model, logs }) => ({
  model,
  logs,
  view,
  error,
  requesting
});

const mapDispatchToProps = dispatch => ({
  fetchModel: () => dispatch(requestModel()),
  saveModel: newModel => {
    dispatch(setModel(newModel));
    dispatch(uploadModel());
  }
});

export default connect(mapPropsToStates, mapDispatchToProps)(MainView);
