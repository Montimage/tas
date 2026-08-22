import React, { Component } from "react";
import { connect } from "react-redux";
import dayjs from "dayjs";
import { Table, Dropdown, Button, Form } from "antd";
import { DownOutlined } from "@ant-design/icons";
import LayoutPage from "./LayoutPage";
import {
  requestTestCase,
  requestAddNewTestCase,
  requestUpdateTestCase,
  requestAllModels,
  requestAllDatasets,
} from "../actions";
import { FormEditableTextItem, FormSelectItem } from "../components/FormItems";
import { getLastPath } from "../utils";
import SelectionModal from "../components/SelectionModal";
// TODO: add dataset
class TestCasePage extends Component {
  constructor(props) {
    super(props);
    const { testCase } = props;
    if (testCase) {
      const {
        id,
        name,
        description,
        tags,
        modelFileName,
        datasetIds,
      } = testCase;
      this.state = {
        id,
        originalId: id,
        name,
        description,
        tags,
        modelFileName,
        datasetIds,
        isChanged: false,
        isNew: false,
        showDatasetModal: false,
      };
    } else {
      const currentTime = Date.now();
      const dsId = getLastPath();
      this.state = {
        id: dsId,
        originalId: null,
        name: `new-test-case-${currentTime}-name`,
        description: `new-test-case-${currentTime}-description`,
        tags: [],
        modelFileName: null,
        datasetIds: [],
        isChanged: true,
        isNew: true,
        showDatasetModal: false,
      };
    }
  }

  componentDidMount() {
    const dsId = getLastPath();
    this.props.fetchTestCase(dsId);
    this.props.fetchModelFiles();
    this.props.fetchDatasets();
  }

  UNSAFE_componentWillReceiveProps(newProps) {
    const { testCase } = newProps;
    if (testCase) {
      const {
        id,
        name,
        description,
        tags,
        modelFileName,
        datasetIds,
      } = testCase;
      this.setState({
        id,
        originalId: id,
        name,
        description,
        tags,
        modelFileName,
        datasetIds,
        isChanged: false,
        isNew: false,
      });
    }
  }

  moveDatasetUp(index) {
    const { datasetIds } = this.state;
    let newDatasetIds = [...datasetIds];
    const selectDS = newDatasetIds[index];
    newDatasetIds[index] = newDatasetIds[index - 1];
    newDatasetIds[index - 1] = selectDS;
    this.setState({ datasetIds: newDatasetIds, isChanged: true });
  }

  moveDatasetDown(index) {
    const { datasetIds } = this.state;
    let newDatasetIds = [...datasetIds];
    const selectDS = newDatasetIds[index];
    newDatasetIds[index] = newDatasetIds[index + 1];
    newDatasetIds[index + 1] = selectDS;
    this.setState({ datasetIds: newDatasetIds, isChanged: true });
  }

  removeDataset(index) {
    const { datasetIds } = this.state;
    let newDatasetIds = [...datasetIds];
    newDatasetIds.splice(index, 1);
    this.setState({ datasetIds: newDatasetIds, isChanged: true });
  }

  updateDatasets(newDatasets) {
    this.setState({ datasetIds: newDatasets, isChanged: true });
  }

  updateId(newId) {
    if (newId !== this.state.originalId) {
      this.setState({ id: newId, isChanged: true });
    }
  }
  updateName(newName) {
    this.setState({ name: newName, isChanged: true });
  }

  updateDescription(newDescription) {
    this.setState({ description: newDescription, isChanged: true });
  }

  updateModelFileName(newModelFileName) {
    this.setState({ modelFileName: newModelFileName, isChanged: true });
  }

  updateTags(newTags) {
    this.setState({ tags: JSON.parse(newTags), isChanged: true });
  }

  saveTestCase() {
    const {
      id,
      name,
      description,
      tags,
      modelFileName,
      datasetIds,
      originalId,
      isNew,
    } = this.state;
    if (isNew) {
      this.props.addNewTestCase({
        id,
        name,
        description,
        tags,
        modelFileName,
        datasetIds,
      });
      this.setState({ isChanged: false, isNew: false, originalId: id });
    } else {
      this.props.updateTestCase(originalId, {
        id,
        name,
        description,
        tags,
        modelFileName,
        datasetIds,
      });
      this.setState({ isChanged: false, originalId: id });
    }
  }

  render() {
    const {
      id,
      name,
      description,
      tags,
      modelFileName,
      datasetIds,
      isChanged,
      showDatasetModal,
    } = this.state;
    const { allModels, allDatasets } = this.props;
    const dataSource = [];

    allDatasets.map((ds) => {
        if (datasetIds.indexOf(ds.id) > -1) {
          dataSource.push({...ds, key: dataSource.length});
        }
      });
    const columns = [
      {
        title: "Id",
        width: 300,
        key: "data",
        render: (ds) => <a href={`/data-sets/${ds.id}`}>{ds.id}</a>,
      },
      {
        title: "Name",
        key: "data",
        render: (ds) => ds.name,
      },
      {
        title: "Created At",
        key: "data",
        sorter: (a, b) => a.createdAt - b.createdAt,
        render: (ds) => dayjs(ds.createdAt).format('MMMM Do YYYY, h:mm:ss a'),
        width: 300,
      },
      {
        width: 150,
        title: "Action",
        key: "data",
        render: (ds) => (
          <Dropdown
            menu={{
              items: [
                ds.key > 0 && {
                  key: "moveup",
                  label: "Move Up",
                  onClick: () => this.moveDatasetUp(ds.key),
                },
                ds.key < dataSource.length - 1 && {
                  key: "movedown",
                  label: "Move Down",
                  onClick: () => this.moveDatasetDown(ds.key),
                },
                {
                  key: "delete",
                  label: "Remove",
                  onClick: () => this.removeDataset(ds.key),
                },
              ].filter(Boolean),
            }}
          >
            <a
              className="ant-dropdown-link"
              onClick={(e) => e.preventDefault()}
            >
              <Button>
                Action <DownOutlined />
              </Button>
            </a>
          </Dropdown>
        ),
      },
    ];
    // TODO: improve the tags view: https://ant.design/components/tag/
    // - color
    // - action remove/add new tags
    return (
      <LayoutPage
        pageTitle={name}
        pageSubTitle="View and update the test case detail"
      >
        <Form labelCol={{ span: 4 }} wrapperCol={{ span: 14 }}>
          <FormEditableTextItem
            label="Id"
            defaultValue={id}
            onChange={(newId) => this.updateId(newId)}
          />
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
          <FormSelectItem
            label="Model File Name"
            defaultValue={modelFileName}
            options={allModels}
            onChange={(newModelFileName) =>
              this.updateModelFileName(newModelFileName)
            }
          />
          <FormEditableTextItem
            label="Tags"
            defaultValue={JSON.stringify(tags)}
            onChange={(newTags) => this.updateTags(newTags)}
          />
        </Form>
        <Button
          style={{ marginBottom: "10px" }}
          onClick={() => {
            if (showDatasetModal === false) {
              this.setState({ showDatasetModal: true });
            }
          }}
        >
          Add Dataset
          <SelectionModal
            title="Dataset"
            enable={showDatasetModal}
            onCancel={() => {
              this.setState({ showDatasetModal: false });
            }}
            defaultValue={datasetIds}
            options={allDatasets}
            onChange={(values) => this.updateDatasets(values)}
          />
        </Button>
        <Table columns={columns} dataSource={dataSource} />
          <Button
            onClick={() => this.saveTestCase()}
            disabled={isChanged ? false : true}
            type="primary"
            size="large"
            style={{
              position: "fixed",
              top: 80,
              right: 20,
            }}
          >
            Save
          </Button>
      </LayoutPage>
    );
  }
}

const mapPropsToStates = ({ testCases, allModels, datasets }) => ({
  testCase: testCases.currentTestCase,
  allModels,
  allDatasets: datasets.allDatasets,
});

const mapDispatchToProps = (dispatch) => ({
  fetchModelFiles: () => dispatch(requestAllModels()),
  fetchTestCase: (testCaseId) => dispatch(requestTestCase(testCaseId)),
  fetchDatasets: () => dispatch(requestAllDatasets()),
  updateTestCase: (originalId, updatedTestCase) =>
    dispatch(
      requestUpdateTestCase({
        id: originalId,
        testCase: updatedTestCase,
      })
    ),
  addNewTestCase: (testCase) => dispatch(requestAddNewTestCase(testCase)),
});

export default connect(mapPropsToStates, mapDispatchToProps)(TestCasePage);
