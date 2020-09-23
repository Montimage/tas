import React, { Component } from "react";
import { connect } from "react-redux";
import { Table, Menu, Dropdown, Button, Form } from "antd";
import { DownOutlined } from "@ant-design/icons";
import LayoutPage from "./LayoutPage";
import {
  requestTestCampaign,
  requestAddNewTestCampaign,
  requestUpdateTestCampaign,
  requestAllTestCases,
} from "../actions";
import { FormEditableTextItem } from "../components/FormItems";
import SelectionModal from "../components/SelectionModal";
import { getLastPath } from "../utils";

//TODO: add test case
class TestCampaignPage extends Component {
  constructor(props) {
    super(props);
    const { testCampaign } = props;
    if (testCampaign) {
      const { id, name, description, testCaseIds } = testCampaign;
      this.state = {
        id,
        originalId: id,
        name,
        description,
        testCaseIds,
        isChanged: false,
        isNew: false,
        showTestCaseModal: false,
      };
    } else {
      const currentTime = Date.now();
      const tcId = getLastPath();
      this.state = {
        id: tcId,
        originalId: null,
        name: `new-test-campaign-${currentTime}-name`,
        description: `new-test-campaign-${currentTime}-description`,
        testCaseIds: [],
        isChanged: true,
        isNew: true,
        showTestCaseModal: false,
      };
    }
  }

  componentDidMount() {
    const tcId = getLastPath();
    this.props.fetchTestCampaign(tcId);
    this.props.fetchTestCases();
  }

  componentWillReceiveProps(newProps) {
    const { testCampaign } = newProps;
    if (testCampaign) {
      const { id, name, description, testCaseIds } = testCampaign;
      this.setState({
        id,
        originalId: id,
        name,
        description,
        testCaseIds,
        isChanged: false,
        isNew: false,
      });
    }
  }

  moveTestCaseUp(index) {
    const { testCaseIds } = this.state;
    let newTestCaseIds = [...testCaseIds];
    const selectTC = newTestCaseIds[index];
    newTestCaseIds[index] = newTestCaseIds[index - 1];
    newTestCaseIds[index - 1] = selectTC;
    this.setState({ testCaseIds: newTestCaseIds, isChanged: true });
  }

  moveTestCaseDown(index) {
    const { testCaseIds } = this.state;
    let newTestCaseIds = [...testCaseIds];
    const selectTC = newTestCaseIds[index];
    newTestCaseIds[index] = newTestCaseIds[index + 1];
    newTestCaseIds[index + 1] = selectTC;
    this.setState({ testCaseIds: newTestCaseIds, isChanged: true });
  }

  removeTestCase(index) {
    const { testCaseIds } = this.state;
    let newTestCaseIds = [...testCaseIds];
    newTestCaseIds.splice(index, 1);
    this.setState({ testCaseIds: newTestCaseIds, isChanged: true });
  }

  updateTestCaseIds(values) {
    this.setState({ testCaseIds: values, isChanged: true });
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

  saveTestCampaign() {
    const {
      id,
      name,
      description,
      testCaseIds,
      originalId,
      isNew,
    } = this.state;
    if (isNew) {
      this.props.addNewTestCampaign({ id, name, description, testCaseIds });
      this.setState({ isChanged: false, isNew: false, originalId: id });
    } else {
      this.props.updateTestCampaign(originalId, {
        id,
        name,
        description,
        testCaseIds,
      });
      this.setState({ isChanged: false, originalId: id });
    }
  }

  render() {
    const {
      id,
      name,
      description,
      testCaseIds,
      isChanged,
      showTestCaseModal,
    } = this.state;

    const dataSource = testCaseIds.map((tcId, index) => ({
      id: tcId,
      key: index,
    }));
    const columns = [
      {
        title: "Id",
        key: "data",
        render: (tc) => <a href={`/test-cases/${tc.id}`}>{tc.id}</a>,
      },
      {
        title: "Action",
        key: "data",
        render: (tc) => (
          <Dropdown
            overlay={
              <Menu>
                {tc.key > 0 && (
                  <Menu.Item
                    key="moveup"
                    onClick={() => this.moveTestCaseUp(tc.key)}
                  >
                    Move Up
                  </Menu.Item>
                )}
                {tc.key < testCaseIds.length - 1 && (
                  <Menu.Item
                    key="movedown"
                    onClick={() => this.moveTestCaseDown(tc.key)}
                  >
                    Move Down
                  </Menu.Item>
                )}
                <Menu.Item
                  key="delete"
                  onClick={() => this.removeTestCase(tc.key)}
                >
                  Remove
                </Menu.Item>
              </Menu>
            }
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
    return (
      <LayoutPage
        pageTitle={name}
        pageSubTitle="View and update the test campaign detail"
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
        </Form>
        <Button
          style={{ marginBottom: "10px", marginRight: 10 }}
          onClick={() => {
            if (showTestCaseModal === false) {
              this.setState({ showTestCaseModal: true });
            }
          }}
        >
          Add Test Case
          <SelectionModal
            title="Select test cases"
            enable={showTestCaseModal}
            onCancel={() => {
              this.setState({ showTestCaseModal: false });
            }}
            defaultValue={testCaseIds}
            options={this.props.allTestCases}
            onChange={(values) => this.updateTestCaseIds(values)}
          />
        </Button>
        <a href={`/reports/?testCampaignId=${id}`}>
          <Button>View All Campaign's Reports</Button>
        </a>
        <Table columns={columns} dataSource={dataSource} />
        <Button
          onClick={() => this.saveTestCampaign()}
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

const mapPropsToStates = ({ testCampaigns, testCases }) => ({
  testCampaign: testCampaigns.currentTestCampaign,
  allTestCases: testCases.allTestCases,
  runningStatus: testCampaigns.runningStatus,
});

const mapDispatchToProps = (dispatch) => ({
  fetchTestCampaign: (testCampaignId) =>
    dispatch(requestTestCampaign(testCampaignId)),
  fetchTestCases: () => dispatch(requestAllTestCases()),
  updateTestCampaign: (originalId, updatedTestCampaign) =>
    dispatch(
      requestUpdateTestCampaign({
        id: originalId,
        testCampaign: updatedTestCampaign,
      })
    ),
  addNewTestCampaign: (testCampaign) =>
    dispatch(requestAddNewTestCampaign(testCampaign)),
});

export default connect(mapPropsToStates, mapDispatchToProps)(TestCampaignPage);
