import React, { Component, Fragment } from "react";
import { connect } from "react-redux";
import moment from "moment";
import { Table, Button } from "antd";
import {
  CaretRightOutlined,
  CopyOutlined,
  DeleteOutlined,
} from "@ant-design/icons";
import LayoutPage from "./LayoutPage";
import {
  requestAllDatasets,
  requestAddNewDataset,
  requestDeleteDataset,
} from "../actions";

class DatasetListPage extends Component {
  componentDidMount() {
    this.props.fetchDatasets();
  }

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

   * @param {Object} ds The selected dataset to be duplicated
   */
  duplicateDataset(ds) {
    const currentTime = Date.now();
    const newDS = {
      id: `${ds.id}-[duplicated]`,
      name: `${ds.name}-[duplicated]`,
      description: ds.description,
      tags: ds.tags,
      createdAt: currentTime,
      lastModified: currentTime,
      source: "MUTATED",
    };
    this.props.addNewDataset(newDS);
  }

  render() {
    const { datasets, deleteDataset } = this.props;
    const dataSource = datasets.map((ds, index) => ({ ...ds, key: index }));
    const columns = [
      {
        title: "Created At",
        key: "data",
        sorter: (a, b) => a.createdAt - b.createdAt,
        render: (ds) => moment(ds.createdAt).format("MMMM Do YYYY, h:mm:ss a"),
        width: 300,
      },
      {
        title: "Id",
        key: "data",
        render: (ds) => <a href={`/data-sets/${ds.id}`}> {ds.id} </a>,
      },
      {
        title: "Action",
        key: "data",
        width: 350,
        render: (ds) => (
          <Fragment>
            <Button size="small" type="dashed" style={{ marginRight: 10 }}>
              <a href={`/simulation?datasetId=${ds.id}`}>
                <CaretRightOutlined /> Simulate
              </a>
            </Button>
            <Button
              size="small"
              style={{ marginRight: 10 }}
              onClick={() => this.duplicateDataset(ds)}
            >
              <CopyOutlined /> Duplicate
            </Button>
            <Button size="small" danger onClick={() => deleteDataset(ds.id)}>
              <DeleteOutlined /> Delete
            </Button>
          </Fragment>
        ),
      },
    ];
    return (
      <LayoutPage pageTitle="Dataset" pageSubTitle="All the datasets">
        <a href={`/data-sets/new-dataset-${Date.now()}`}>
          <Button style={{ marginBottom: "10px" }}>Add New Dataset</Button>
        </a>
        <Table columns={columns} dataSource={dataSource} />
      </LayoutPage>
    );
  }
}

const mapPropsToStates = ({ datasets }) => ({
  datasets: datasets.allDatasets,
});

const mapDispatchToProps = (dispatch) => ({
  fetchDatasets: () => dispatch(requestAllDatasets()),
  deleteDataset: (datasetId) => dispatch(requestDeleteDataset(datasetId)),
  addNewDataset: (dataset) => dispatch(requestAddNewDataset(dataset)),
});

export default connect(mapPropsToStates, mapDispatchToProps)(DatasetListPage);
