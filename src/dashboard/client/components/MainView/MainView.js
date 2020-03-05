import React, { Component } from 'react';
import { connect } from 'react-redux';
import { Button } from 'antd';

import { loadModel, setModel, saveModel } from '../../actions';
import JSONView from '../JSONView';
import GraphView from './GraphView';
import ListView from './ListView';
// import 'jsoneditor-react/es/editor.min.css';
import './styles.css';

// console.log(ace.acequire('editor'));
class MainView extends Component {

  componentDidMount() {
    this.props.fetchModel();
  }

  render() {
    const { error, isLoading,model, view,contentType, logs , updateModel, saveModel} = this.props;
    return (
      <div className="content">
        {isLoading ? (
          <span>Loading ...</span>
        ) : ( error ? (
          <span> There are some error {error}</span>
        ) : (contentType === 'logs' ? (
          <p>
            {logs}
          </p>
        ):(
          <div>
            { view === 'json' ? (
              <JSONView
                value={model}
                onChange={updateModel}
              />
            ) : ( view ==='graph' ? (
              <GraphView
                value={model}
                onChange={updateModel}
              />
            ) : (
              <ListView
                value={model}
                onChange={updateModel}
              />
            )
            )}
            <Button type="default" shape="round" onClick={saveModel} style={{marginTop: '10px'}}>
              Save
            </Button>
          </div>
        )))}
      </div>
    );
  }
}

const mapPropsToStates = ({ loadModel, saveModel, logs, contentType, view }) => ({
  isLoading: loadModel.fetching || saveModel.fetching || logs.fetching,
  model: loadModel.model,
  error: loadModel.error ? loadModel.error : (saveModel.error ? saveModel.error : logs.error),
  logs: logs.logs,
  view,
  contentType
});

const mapDispatchToProps = dispatch => ({
  fetchModel: () => dispatch(loadModel()),
  updateModel: (model) => dispatch(setModel(model)),
  saveModel: () => dispatch(saveModel())
});

export default connect(
  mapPropsToStates,
  mapDispatchToProps,
)(MainView);
